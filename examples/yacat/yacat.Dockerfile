FROM dizcza/docker-hashcat:intel-cpu-legacy

VOLUME /golem/input /golem/output /golem/work
WORKDIR /golem/entrypoint
