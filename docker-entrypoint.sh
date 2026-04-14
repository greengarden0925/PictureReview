#!/bin/sh
set -e

DATA_DIR="${PICTURE_REVIEW_DATA_DIR:-/data}"
mkdir -p "${DATA_DIR}"

# 若 volume 內尚無 survey.json，複製 image 內建的預設版本
if [ ! -f "${DATA_DIR}/survey.json" ]; then
  echo "[init] survey.json 不存在，複製預設問卷至 ${DATA_DIR}/"
  cp /app/defaults/survey.json "${DATA_DIR}/survey.json"
fi

# 若 volume 內尚無 assignment.json，複製 image 內建的預設版本
if [ ! -f "${DATA_DIR}/assignment.json" ]; then
  echo "[init] assignment.json 不存在，複製預設分配至 ${DATA_DIR}/"
  cp /app/defaults/assignment.json "${DATA_DIR}/assignment.json"
fi

exec "$@"
