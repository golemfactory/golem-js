ARG UBUNTU_VERSION=22.04
ARG YA_CORE_VERSION=0.12.3

FROM node:18
ARG YA_CORE_VERSION
ARG YA_DIR_INSTALLER=/ya-installer
ARG YA_DIR_BIN=/usr/bin
RUN apt-get update -q \
    && apt-get install -q -y --no-install-recommends \
    wget \
    apt-transport-https \
    ca-certificates \
    xz-utils \
    curl \
    sshpass \
    python3 \
    libgtk2.0-0 \
    libgtk-3-0 \
    libgbm-dev \
    libnotify-dev \
    libgconf-2-4 \
    libnss3 \
    libxss1 \
    libasound2 \
    libxtst6 \
    xauth \
    xvfb \
    chromium \
    && apt-get remove --purge -y \
    && apt-get clean -y \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir ${YA_DIR_INSTALLER} \
    && cd ${YA_DIR_INSTALLER} \
    && wget -q "https://github.com/golemfactory/yagna/releases/download/v${YA_CORE_VERSION}/golem-requestor-linux-v${YA_CORE_VERSION}.tar.gz" \
    && tar -zxvf golem-requestor-linux-v${YA_CORE_VERSION}.tar.gz \
    && find golem-requestor-linux-v${YA_CORE_VERSION} -executable -type f -exec cp {} ${YA_DIR_BIN} \; \
    && rm -Rf ${YA_DIR_INSTALLER} \
    && wget -O ${YA_DIR_BIN}/websocat "https://github.com/vi/websocat/releases/download/v1.12.0/websocat_max.x86_64-unknown-linux-musl" \
    && chmod +x ${YA_DIR_BIN}/websocat


COPY ./start-requestor.sh /start-requestor.sh

CMD ["bash", "-c", "/start-requestor.sh"]
