#!/usr/bin/env bash
set -eou pipefail

# test if docker is already running & start if not
if ! docker info > /dev/null 2>&1; then
    echo "Docker is not running. Starting Docker..."
    docker desktop start
else
    echo "Docker is running"
fi

# start db and solr first so demo db is loaded before app runs migrations
docker compose up -d --wait db solr

# TODO option to wipe-recreate the db
if [ -z "$(mysql --host=127.0.0.1 --port=3308 -u root -proot -N -e "SHOW TABLES LIKE 'schema_info';" archivesspace 2>/dev/null)" ]; then
    echo "Loading demo database..."
    gzip -dc ../archivesspace/build/mysql_db_fixtures/demo.sql.gz | mysql --host=127.0.0.1 --port=3308 -u root -proot archivesspace
else
    echo "Database already initialized, skipping demo load"
fi

# start app service
docker compose up -d app
