#! /bin/bash

# npm --registry=https://registry.npm.taobao.org --disturl=https://npm.taobao.org/dist install

echo "stopping service....."
forever stop app/index.js
echo "service stopped!"

echo "starting service...."
export MONGODB_URL="mongodb://localhost:27017/fxshop_test"
export REDIS_HOST="127.0.0.1"
export NODE_ENV="production"
export INDEX_PAGE_FILE_LOCATION="/data/apps/fxshop-h5/test/index.html"
export MCHT_INDEX_PAGE_FILE_LOCATION="/data/apps/fxshop-merchant/test/index.html"
export FX_ORDER_PAYING_LIST="fx_order_paying_list_test"
export TICKET_QRCODE_PATH="/data/apps/fxshop-backend/test/qrcode"

forever start app/index.js
echo "service started!"
forever list

