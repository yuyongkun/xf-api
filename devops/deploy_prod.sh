#! /bin/bash

rsync -av app webedit@120.76.54.130:~/apps/fxshop-backend/test
scp package-lock.json package.json ./devops/start_service.sh webedit@120.76.54.130:~/apps/fxshop-backend/test

# ssh webedit@120.76.54.130 "cd /home/webedit/apps/fxshop-backend/test && ./start_service.sh"
