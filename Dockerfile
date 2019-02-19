FROM ubuntu

WORKDIR /app

COPY . .

RUN apt update \
&& apt install wget unzip -y \
&& setup/pre.sh \
&& setup/ubuntu.sh \
&& setup/post.sh

RUN mkdir -p certificates/intermediaries \
&& mkdir -p certificates/results

ENTRYPOINT ["node", "./index.js"]
