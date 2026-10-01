#!/bin/sh
# Run a command in the render image (Dockerfile.render: Chromium's libs, which the VPS host lacks).
# Same paths inside as outside. Build once: docker build -t deskling-remotion -f Dockerfile.render .
exec docker run --rm -u "$(id -u):$(id -g)" -m 3g -e HOME=/tmp \
  -v /home/obp/deskling:/home/obp/deskling -w /home/obp/deskling/videos deskling-remotion "$@"
