#!/usr/bin/env bash

cat images | while read line; do docker rmi 127.0.0.1:9999/$line & done &

wait

for n in `seq 1 10`; do
  cat images | while read line; do docker pull 127.0.0.1:9999/$line & done &
done

wait