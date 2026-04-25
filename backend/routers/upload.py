from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, UploadFile, HTTPException
from sqlalchemy.orm import Session

from backend.db.models import Position, Transaction, Upload, User
from backend.db.session import get_db
from backend.services.pdf_parser import parse_brokerage_pdf

router = APIRouter()


@router.post("/api/upload")
async def upload_pdf(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    # Read bytes in memory; never write to disk
    pdf_bytes = await file.read()
    file_size = len(pdf_bytes)

    result = parse_brokerage_pdf(pdf_bytes)
    del pdf_bytes  # discard immediately after parsing

    user = db.query(User).first()
    if user is None:
        raise HTTPException(status_code=400, detail="No user data found — run seed first")
    uid = user.id

    for pos in result.positions:
        if pos.purchase_date is None:
            from datetime import date
            pos.purchase_date = date.today()
        db.add(Position(
            user_id=uid,
            asset_type=pos.asset_type,
            ticker_or_name=pos.ticker,
            quantity=pos.quantity,
            cost_basis_per_unit=pos.cost_basis_per_unit,
            current_price=pos.current_price,
            purchase_date=pos.purchase_date,
        ))

    for txn in result.transactions:
        db.add(Transaction(
            user_id=uid,
            asset_type=txn.asset_type,
            ticker_or_name=txn.ticker,
            action=txn.action,
            quantity=txn.quantity,
            price_per_unit=txn.price_per_unit,
            total_proceeds=txn.total_proceeds,
            total_cost_basis=txn.total_cost_basis,
            transaction_date=txn.transaction_date,
            is_wash_sale=txn.is_wash_sale,
        ))

    db.add(Upload(
        user_id=uid,
        filename=file.filename,
        upload_date=datetime.now(timezone.utc),
        parsed_status="success",
        extracted_field_count=result.extracted_field_count,
    ))
    db.commit()

    return {
        "filename": file.filename,
        "positions_added": len(result.positions),
        "transactions_added": len(result.transactions),
        "extracted_field_count": result.extracted_field_count,
    }
