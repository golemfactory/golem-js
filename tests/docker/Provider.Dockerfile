ARG UBUNTU_VERSION=22.04
ARG YA_CORE_PROVIDER_VERSION=v0.12.3
ARG YA_WASI_VERSION=v0.2.2
ARG YA_VM_VERSION=v0.3.0

FROM ubuntu:${UBUNTU_VERSION}
ARG YA_CORE_PROVIDER_VERSION
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
    && wget -q "https://github.com/golemfactory/yagna/releases/download/${YA_CORE_PROVIDER_VERSION}/golem-provider-linux-${YA_CORE_PROVIDER_VERSION}.tar.gz" \
    && wget -q "https://github.com/golemfactory/ya-runtime-wasi/releases/download/${YA_WASI_VERSION}/ya-runtime-wasi-linux-${YA_WASI_VERSION}.tar.gz" \
    && wget -q "https://github.com/golemfactory/ya-runtime-vm/releases/download/${YA_VM_VERSION}/ya-runtime-vm-linux-${YA_VM_VERSION}.tar.gz" \
    && tar -zxvf golem-provider-linux-${YA_CORE_PROVIDER_VERSION}.tar.gz \
    && tar -zxvf ya-runtime-wasi-linux-${YA_WASI_VERSION}.tar.gz \
    && tar -zxvf ya-runtime-vm-linux-${YA_VM_VERSION}.tar.gz \
    && find golem-provider-linux-${YA_CORE_PROVIDER_VERSION} -executable -type f -exec cp {} ${YA_DIR_BIN} \; \
    && cp -R golem-provider-linux-${YA_CORE_PROVIDER_VERSION}/plugins/* ${YA_DIR_PLUGINS} \
    && cp -R ya-runtime-wasi-linux-${YA_WASI_VERSION}/* ${YA_DIR_PLUGINS} \
    && cp -R ya-runtime-vm-linux-${YA_VM_VERSION}/* ${YA_DIR_PLUGINS} \
    && rm -Rf ${YA_DIR_INSTALLER}
COPY ./configureProvider.py /configureProvider.py

CMD ["bash", "-c", "python3 /configureProvider.py && ya-provider rule set outbound everyone --mode whitelist && ya-provider whitelist add -p ipfs.io && golemsp run --payment-network testnet " ]
