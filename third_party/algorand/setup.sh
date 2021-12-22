#!/bin/bash

# python3 setup.py --devnet --appid 4 --teal_dir teal; python3 setup.py --test --appid 4

dn="$(dirname "$0")"
cd $dn

pipenv install

pipenv run python3 setup.py --devnet
