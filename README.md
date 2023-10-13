# SOTA Web API

backend for https://tzwolak.com/map.html

## Dev

    docker compose start db

    psql -h localhost -U postgres
    CREATE ROLE sota_web_dev WITH LOGIN PASSWORD 'dev';
    CREATE DATABASE sota_web_dev OWNER = sota_web_dev;

https://github.com/mbucc/shmig

    shmig -A -t postgresql -d sota_web_dev -H localhost -l sota_web_dev migrate

nodejs v18 recommended

    npm install
    npm run dev
