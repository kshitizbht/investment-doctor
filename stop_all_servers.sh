#!/bin/bash
lsof -ti:8000 | xargs kill -9 2>/dev/null && echo "Killed port 8000" || echo "Nothing on port 8000"
lsof -ti:3000 | xargs kill -9 2>/dev/null && echo "Killed port 3000" || echo "Nothing on port 3000"
rm -f /tmp/backend.log /tmp/frontend.log && echo "Removed log files"
