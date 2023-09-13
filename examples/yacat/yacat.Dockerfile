FROM ubuntu
WORKDIR /golem/work
RUN apt-get update
RUN apt-get install -y hashcat