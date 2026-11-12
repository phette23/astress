# ArchivesSpace Stress Testing

Testing how ASpace holds up over various levels of both public traffic and API usage. Inspired by `ab`.

## Setup

Requires docker, node, and pnpm.

Configure [the compute limits](#compute-scaling) you want in a .env file or modify .env.docker.dev directly. In docker-compose.yml, you can set the ArchivesSpace version you want to test on the `image` line.

Configure [the traffic levels](#traffic-levels) you want in config.json.

## Usage

1. Start the docker container for ArchivesSpace. `./start.sh` should do most of this. Docker config was copied from the main ArchivesSpace repo. It can take a while for the container to be ready with loaded data; check the PUI URL in a browser to see if it is ready or watch the logs with `docker compose logs app -f`.
2. Create your own configuration based on the testing you want to do `cp config.example.json config.json`.
3. Look up resource IDs in ArchivesSpace; `astress discover [-f config.json]`. This writes `.astress-resources.json` with IDs so tests hit actual resources instead of 404ing.
4. Run the stress test `astress run [-f config.json]`.
5. Optionally, try to use the local site while the stress test is running.
6. Run `docker compose down` when done.

## Limitations

Large background jobs are probably the number one reason for poor server responsiveness and this project doesn't test that yet. We could add jobs to the workload categories and/or do something specific with an import of a large data file.

Only using the demo database for now, so if it is not representative, the tests won't be either.

`astress discover` filters out unpublished repositories, but uses `?all_ids=true` to list record IDs within published repositories. Because `?all_ids=true` does not filter by `publish` status, `.astress-resources.json` can include unpublished records that return `404` on the PUI.

There are no Classification objects in the demo data and limited numbers of some other things which might make tests different from actual instances.

OAI is not tested but maybe this is a good future feature.

## Compute Scaling

Use [the `deploy.resources` section of docker-compose.yml](https://docs.docker.com/reference/compose-file/deploy/#resources)to set CPU and memory limits for the ArchivesSpace container. These limit values are read from .env.docker.dev first, with defaults, and can be overridden by a local .env file. The idea is to match the compute resources a particular hosting service offers. I recommend setting the `limits` and `reservations` to be the same so the container is guaranteed to have that much compute available.

You can edit `JAVA_OPTS` in .env.docker.dev to set heap size and other JVM options.

## Traffic Levels

Configure overall traffic in the `run.settings` section of config.json. The test runs until either `requests` total requests have been made or `duration` (in seconds) has elapsed. Either can be set to `null`. If both are set to `null`, the test runs indefinitely until manually stopped. A bounded, random millisecond `delay` is added between requests.

The `run.workloads` section divides up requests between public browsing, searching, and staff API usage. You can weight those three categories relative to each other and then also weight the types of resources being accessed within each category.

## ArchivesSpace Configuration

One way to test different ArchivesSpace configurations is to build your own docker image and replace the `app.image` line in docker-compose.yml. You could also edit the config files on the container (e.g. by `docker cp` them into place or `docker exec`) and restarting the services.
