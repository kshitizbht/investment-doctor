import json
import os
from typing import Any, Dict, Optional

import anthropic
from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

load_dotenv()

router = APIRouter()

_client: Optional[anthropic.Anthropic] = None


def _get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise HTTPException(
                status_code=503,
                detail="ANTHROPIC_API_KEY not set in .env — add it to enable Ask Claude",
            )
        _client = anthropic.Anthropic(api_key=api_key)
    return _client


def _build_prompt(snapshot: Dict[str, Any], question: str) -> str:
    ts = snapshot.get("tax_snapshot", {})
    cg = snapshot.get("capital_gains", {})
    harv = snapshot.get("harvesting", {})
    alerts = snapshot.get("holding_period_alerts", [])
    ab = snapshot.get("asset_breakdown", {}).get("by_type", {})
    nw = snapshot.get("net_worth", {})

    lines = [
        "## Client Financial Snapshot (2024 tax year)",
        "",
        f"**Net Worth:** ${nw.get('total', 0):,.0f}  "
        f"(Stocks ${nw.get('stocks_value', 0):,.0f} | "
        f"Real Estate ${nw.get('real_estate_value', 0):,.0f} | "
        f"Wages ${nw.get('income_value', 0):,.0f})",
        "",
        "### Tax Position",
        f"- AGI: ${ts.get('agi', 0):,.0f}",
        f"- Federal bracket: {ts.get('federal_bracket_pct', 0)}%  |  "
        f"State bracket: {ts.get('state_bracket_pct', 0)}%",
        f"- Est. federal tax: ${ts.get('estimated_federal_tax', 0):,.0f}  |  "
        f"Est. state tax: ${ts.get('estimated_state_tax', 0):,.0f}",
        "",
        "### Realized Capital Gains",
        f"- Short-term: ${cg.get('short_term_realized', 0):,.0f}  "
        f"(taxed at ordinary income rate)",
        f"- Long-term: ${cg.get('long_term_realized', 0):,.0f}  "
        f"(taxed at LTCG rate)",
        f"- Net realized: ${cg.get('net_realized', 0):,.0f}",
        "",
        "### Unrealized Gains / Losses by Asset Class",
    ]

    for asset, vals in ab.items():
        gl = vals.get("unrealized_gain_loss", 0)
        sign = "+" if gl >= 0 else ""
        lines.append(f"- {asset.capitalize()}: {sign}${gl:,.0f}  "
                     f"({vals.get('pct_of_portfolio', 0):.1f}% of portfolio)")

    lines += [
        "",
        "### Tax-Loss Harvesting Opportunities",
        f"- Total harvestable loss: ${harv.get('total_harvestable_loss', 0):,.0f}",
        f"- Estimated tax savings: ${harv.get('estimated_tax_savings', 0):,.0f}",
    ]

    opps = harv.get("opportunities", [])
    for o in opps[:5]:
        wash = " ⚠️ wash-sale risk" if o.get("wash_sale_risk") else ""
        lines.append(f"  • {o['ticker_or_name']} ({o['asset_type']}): "
                     f"-${abs(o['unrealized_loss']):,.0f}{wash}")

    if alerts:
        lines += ["", "### Holding-Period Alerts (approaching LTCG threshold)"]
        for a in alerts[:5]:
            lines.append(f"  • {a['ticker_or_name']}: {a['days_until_ltcg']} days until LTCG — "
                         f"waiting saves ~${a['estimated_tax_saving']:,.0f}")

    lines += [
        "",
        "---",
        f"**User question:** {question}",
    ]

    return "\n".join(lines)


class AskClaudeRequest(BaseModel):
    snapshot: Dict[str, Any]
    question: str


@router.post("/api/ask-claude")
def ask_claude(req: AskClaudeRequest):
    client = _get_client()
    prompt = _build_prompt(req.snapshot, req.question)

    def token_stream():
        try:
            with client.messages.stream(
                model="claude-opus-4-7",
                max_tokens=1024,
                system=(
                    "You are a knowledgeable US tax advisor analyzing a client's investment "
                    "and income snapshot. Provide concise, actionable advice focused on legal "
                    "tax reduction strategies. Be specific — reference the actual numbers from "
                    "the snapshot. Use plain language; avoid jargon. Format with short bullet "
                    "points or numbered steps when listing actions. Do not disclaim that you "
                    "are not a licensed advisor — the user understands this is AI guidance."
                ),
                messages=[{"role": "user", "content": prompt}],
            ) as stream:
                for text in stream.text_stream:
                    yield f"data: {json.dumps({'text': text})}\n\n"
        except anthropic.APIStatusError as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
        finally:
            yield "data: [DONE]\n\n"

    return StreamingResponse(token_stream(), media_type="text/event-stream")
