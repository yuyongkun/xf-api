#! /bin/bash

npm install

forever stop app/index-test.js

export MONGODB_URL="mongodb://localhost:27017/fxshop_test"
export REDIS_HOST="127.0.0.1"
export NODE_ENV="production"
export PORT=8880
export INDEX_PAGE_FILE_LOCATION="/data/apps/fxshop-h5/prod/index.html"
export MCHT_INDEX_PAGE_FILE_LOCATION="/data/apps/fxshop-merchant/prod/index.html"
export TICKET_QRCODE_PATH="/data/apps/fxshop-backend/test/qrcode"

forever start app/index-test.js
forever list