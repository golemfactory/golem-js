ARG UBUNTU_VERSION=22.04
ARG YA_CORE_VERSION=0.12.3
ARG YA_WASI_VERSION=0.2.2
ARG YA_VM_VERSION=0.3.0

FROM ubuntu:${UBUNTU_VERSION}
ARG YA_CORE_VERSION
ARG YA_WASI_VERSION
ARG YA_VM_VERSION
ARG YA_DIR_INSTALLER=/ya-installer
ARG YA_DIR_BIN=/usr/bin
ARG YA_DIR_PLUGINS=/lib/yagna/plugins
COPY /data-node/ya-provider/ /root/.local/share/ya-provider/
RUN apt-get update -q \
    && apt-get install -q -y --no-install-recommends \
    wget \
    apt-transport-https \
    ca-certificates \
    xz-utils \
    curl \
    python3 \
    && apt-get remove --purge -y \
    && apt-get clean -y \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p ${YA_DIR_PLUGINS} \
    && mkdir ${YA_DIR_INSTALLER} \
    && cd ${YA_DIR_INSTALLER} \
    && wget -q "https://github.com/golemfactory/yagna/releases/download/v${YA_CORE_VERSION}/golem-provider-linux-v${YA_CORE_VERSION}.tar.gz" \
    && wget -q "https://github.com/golemfactory/ya-runtime-wasi/releases/download/v${YA_WASI_VERSION}/ya-runtime-wasi-linux-v${YA_WASI_VERSION}.tar.gz" \
    && wget -q "https://github.com/golemfactory/ya-runtime-vm/releases/download/v${YA_VM_VERSION}/ya-runtime-vm-linux-v${YA_VM_VERSION}.tar.gz" \
    && tar -zxvf golem-provider-linux-v${YA_CORE_VERSION}.tar.gz \
    && tar -zxvf ya-runtime-wasi-linux-v${YA_WASI_VERSION}.tar.gz \
    && tar -zxvf ya-runtime-vm-linux-v${YA_VM_VERSION}.tar.gz \
    && find golem-provider-linux-v${YA_CORE_VERSION} -executable -type f -exec cp {} ${YA_DIR_BIN} \; \
    && cp -R golem-provider-linux-v${YA_CORE_VERSION}/plugins/* ${YA_DIR_PLUGINS} \
    && cp -R ya-runtime-wasi-linux-v${YA_WASI_VERSION}/* ${YA_DIR_PLUGINS} \
    && cp -R ya-runtime-vm-linux-v${YA_VM_VERSION}/* ${YA_DIR_PLUGINS} \
    && rm -Rf ${YA_DIR_INSTALLER}
COPY ./configureProvider.py /configureProvider.py

CMD ["bash", "-c", "python3 /configureProvider.py && golemsp run --payment-network testnet"]
