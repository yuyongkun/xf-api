#! /bin/bash

rsync -av app webedit@120.76.54.130:~/apps/fxshop-backend/prod
scp package-lock.json package.json ./devops/start_service_test.sh webedit@120.76.54.130:~/apps/fxshop-backend/prod
