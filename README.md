
Are We Compressed Yet?
====
This repository contains the arewecompressedyet.com website source code.

How to use DEV version of Docker
=======

This version support DEV docker for debugging source code in rd_tool and Web service.

User can directly use the built image in docker hub:
~~~
docker pull jwduck/awcy:dev
~~~
Or build your own docker image with Dockerfile.dev:
~~~
cd <your_path_to_awcy>
docker build -f ./Dockerfile.dev -t <your_docker_name>:<tag> .
~~~

To use this dev docker, you need to prepare your own rd_tool and www source code, and mount them in docker volumes as:
~~~
docker run -it --rm -w /etc -v <your_rdtool_path>:/opt/rd_tool -v <your_www_path>:/opt/app/www --publish 3000:3000 -v <your_awcy_data_path>:/data -v <your_awcy_media_path>:/media --env MEDIAS_SRC_DIR=/media --env AWCY_API_KEY=<your_api_key> --env LOCAL_WORKER_ENABLED=true --env LOCAL_WORKER_SLOTS=4 jwduck/awcy:dev bash
> chmod 777 /etc/dev_launch.sh
> /etc/dev_launch.sh
~~~

Running your own local copy of the website
===
To run a local copy, you will need a copy of node and npm.

You will need node, npm, etc. For Ubuntu:
```
sudo apt install nodejs npm nodejs-legacy libicu-dev
```
You'll also need tools to build AV1 or other codecs being tested:
```
sudo apt install yasm libtool
```

First, run the `./setup.sh` script. It will create directories needed for AWCY to run.

Next, create a configuration file called `config.json`.

Here is an example config.json:

```
{ "channel": "#daalatest",
  "have_aws": false,
  "port": 3000,
  "rd_server_url": "http://localhost:4000"
}
```

You will also need a file called `secret_key` which contains the key needed to use the website.

```
echo 'fake_password_to_compile' > secret_key
```

These commands will create the configuration files and install the node.js modules that get used by
awcy. Open a node command line and run the following:

```
cd www
npm install
cd ..
npm install
npm start
```

To run the server, execute the run_awcy.bat file
or run the following in your command line:
```
  node awcy_server.js
```
Now you can open localhost:3000 with your browser to see your local version of the website.

Setting up repositories
===
For the website to build codecs, you need local checkouts of every codec. While the `./setup.sh` script
automatically adds AV1, you can add your own. For example:
```
git clone https://aomedia.googlesource.com/aom av1
ln -s av1 av1-rt
```

Setting up rd_server
===
The AWCY web server manages the repositories and runs/ directory, and compiles and builds the codecs. Once this is done, it hands off the job of actually talking to all the AWS machines to rd_server.

To install rd_server, checkout the rd_tool repository in the same directory as awcy:
```
git clone https://github.com/tdaede/rd_tool.git
```

Then start the rd_server.py daemon:
```
./rd_server.py
```
The rd_server.py daemon listens on port 4000 by default.

More documentation on rd_server.py can be found in its README.

Setting up workers
===
Workers are Linux machines accessible over ssh. They need to be the same architecture as the AWCY server.

A worker needs a AWCY work root, which has a directory structure as follows:
```
dump_ciede2000/
daalatool/
slot0/
vmaf/
```

The slot* directores are created by AWCY for jobs.

daalatool must be pre-populated by a clone of the daala repo, with tools built (make tools):

```
git clone https://git.xiph.org/daala.git daalatool
cd daalatool
./autogen.sh
./configure
make
make tools
```

dump_ciede2000 must be populated by a built version of the dump_ciede2000 tool:

```
git clone https://github.com/KyleSiefring/dump_ciede2000
cd dump_ciede2000
cargo build --release
```

vmaf is a clone of the Netflix VMAF repository, also built.

In addition, a copy of the test media must be accessible to the worker.

The workers should be configured on the main server with a machines.json file, which contains the host, user and port (for ssh). In addition, it contains the number of cores (which controlls the number of slots), plus the work root (containing the above mentioned directores) and the test media path. For example:

```
[
  {
    "host": "localhost",
    "user": "xiph",
    "cores": 8,
    "port": 22,
    "work_root": "/home/xiph/awcy_temp",
    "media_path": "/home/xiph/sets/"
  },
]
```

Each worker must have a unique work root - usually local storage on the worker. One worker is intended to be one physical machine or VM. For testing purposes, one machine can act as multiple workers, but the work_root must be independent. The media path is read-only and can be shared, e.g. via NFS.

The machines should be accesible via passwordless SSH authentication. If needed, the SSH_PRIVKEY_FILE environment variable can inform rd_server.py of a custom private key (.pem format) to use for logging into workers.

Run database format
===
The runs/ directory will contain all of the output files generated from a job. There is a info.json file that specifies what options were used by that particular run. Here is an example of an info.json file:

  {"codec":"daala","commit":"","run_id":"2014-09-19T22-00-08.196Z","task":"video-1-short","nick":"AWCY","task_type":"video"}

There is also an output.txt file that contains the output of the rd_tool.py script.

After each run, a cache file called list.json file is generated by the generate_list.js script. This contains all of the info.json files, as an ordered list. This should probably be replaced by a "real" database at some point.

Docker support
===

AWCY can be started as a docker container for local usage or development.

Build (server)
----

The docker image is pretty large (3.3 GB), as it includes:

 * build dependencies for all codecs to be built (gcc/g++, autotools, make, rust, ...)
 * build dependencies for the WebUI (nodejs, emscripten, ...)
 * runtime dependencies for build and analysis scripts (python, daalatool, ...)

Note: this image has not been optimized for size yet, and may be split in the future.

To build the image:

```sh
docker build --tag xiph/awcy:latest .
```

Build (worker)
----

Another dockerfile (`Dockerfile.worker`) is available to create worker nodes.

To build the worker image:

```sh
docker build --file Dockerfile.worker --tag xiph/awcy-worker:latest .
```

Run (all-in-one)
----

You can run an all-in-one container which will start:

 * awcy server
 * rd_server
 * sshd (to emulate a local rd_tool worker)

In addition, a git clone of every codecs' source is going to be done from upstream at initial startup.

Configuration is driven by a few environment variables (with their default values):

 * `CONFIG_DIR=/data/conf`: configuration files, sqlite database, generate SSH keys, set list, ...
 * `CODECS_SRC_DIR=/data/src`: where codecs' sources are going to be cloned (and compiled)
 * `RUNS_DST_DIR=/data/runs`: rd_tool jobs runs output
 * `WORK_DIR=/data/work`: rd_tool job workdir directory
 * `MEDIAS_SRC_DIR=/data/media`: directory containing media files ( get them from https://people.xiph.org/~tdaede/sets/ )
 * `LOCAL_WORKER_ENABLED=false`: if a local worker need to be started and configured
 * `LOCAL_WORKER_SLOTS=$(nproc)`: number of slots for the local worker
 * `IRC_CHANNEL=none`: IRC notifications target channel (`none` means disabled)
 * `AWCY_API_KEY=awcy_api_key`: WebUI/API key
 * `AWCY_SERVER_PORT=3000`: awcy server listening port
 * `RD_SERVER_PORT=4000`: rd_server listening port

Simple run example (all data will be contained on the docker host in `/tmp/awcy`):

```sh
docker run \
	-it \
	--rm \
	--name xiph-awcy \
	--publish 3000:3000 \
	--volume /tmp/awcy:/data \
	--volume ${HOME}/xiph-media-files:/media \
	--env MEDIAS_SRC_DIR=/media \
	--env AWCY_API_KEY=complicated_password \
	--env LOCAL_WORKER_ENABLED=true \
	--env LOCAL_WORKER_SLOTS=4 \
	xiph/awcy:latest
```

Output:

```
--2019-01-16 22:46:11--  https://people.xiph.org/~tdaede/sets/subset1-monochrome/Claudette_14_july_2003_1920Z.y4m
Resolving people.xiph.org (people.xiph.org)... 140.211.15.28, 2001:470:eb26:54::1
Connecting to people.xiph.org (people.xiph.org)|140.211.15.28|:443... connected.
HTTP request sent, awaiting response... 200 OK
Length: 1485050 (1.4M) [application/octet-stream]
Saving to: ‘/media/awcy-builder-quicktest/test_frame.y4m’

/media/awcy-builder-quicktest/test_frame.y4m         100%[=====================================================================================================================>]   1.42M  1.14MB/s    in 1.2s

2019-01-16 22:46:13 (1.14 MB/s) - ‘/media/awcy-builder-quicktest/test_frame.y4m’ saved [1485050/1485050]

Cloning into '/data/src/av1'...
remote: Sending approximately 132.14 MiB ...
remote: Counting objects: 8, done
remote: Finding sources: 100% (5/5)
remote: Total 193273 (delta 156479), reused 193273 (delta 156479)
Receiving objects: 100% (193273/193273), 132.11 MiB | 2.33 MiB/s, done.
Resolving deltas: 100% (156479/156479), done.
Cloning into '/data/src/daala'...
remote: Enumerating objects: 12671, done.
remote: Total 12671 (delta 0), reused 0 (delta 0), pack-reused 12671
Receiving objects: 100% (12671/12671), 8.70 MiB | 2.37 MiB/s, done.
Resolving deltas: 100% (9442/9442), done.
Cloning into '/data/src/rav1e'...
remote: Enumerating objects: 1, done.
remote: Counting objects: 100% (1/1), done.
remote: Total 4426 (delta 0), reused 0 (delta 0), pack-reused 4425
Receiving objects: 100% (4426/4426), 2.61 MiB | 2.33 MiB/s, done.
Resolving deltas: 100% (3108/3108), done.
Cloning into '/data/src/thor'...

(...)

Generating SSH host keys
Generating public/private rsa key pair.
Your identification has been saved in /data/conf/awcy.pem.
Your public key has been saved in /data/conf/awcy.pem.pub.
The key fingerprint is:
SHA256:TJa3T7FZhByGZ3owJOtV/OXk75nyBJa8I7pq2BwNEaU xiph@4ee6bf6c8ffe
The key's randomart image is:
+---[RSA 2048]----+
|       .+o.++o.  |
|       ..++o*.  o|
|       E* o*...= |
|       * o..o=o o|
|        S ..+=  .|
|       . . o. o .|
|      + .  ..o oo|
|     . +  . ..oo.|
|      ...o.   o. |
+----[SHA256]-----+
STARTING SSHD SERVICE
STARTING AWCY SERVICE
STARTING RDTOOL SERVICE
AWCY server started! Open a browser at http://172.20.0.12:3000
AWCY server directory: /opt/app
Configuration directory: /data/conf
Codecs git repositories location: /data/src
Media samples directory: /media
Runs output directory: /data/runs
```

If you open your browser at http://localhost:3000 (or the one in the container output), you should see the AWCY WebUI.

On initial startup, the following configuration files are generated:

```
/tmp/awcy/conf/awcy.pem
/tmp/awcy/conf/awcy.pub
/tmp/awcy/conf/config.json
/tmp/awcy/conf/list.json
/tmp/awcy/conf/machines.json
/tmp/awcy/conf/secret_key
/tmp/awcy/conf/sets.json
/tmp/awcy/conf/subjective.sqlite3
```

Run (with workers)
----

You first need to start an AWCY server instance using the [all-in-one instructions](#run-all-in-one), but setting `LOCAL_WORKER_ENABLED` to false.

Next, run once instance of the worker container on each worker machine. FOr testing, you can also run multiple workers on your local machine. In a second terminal, start one or more worker instances:

```sh
docker run \
	-it \
	--detach \
	--name xiph-awcy-worker-1 \
	--volume ${HOME}/xiph-media-files:/media \
	--env SSH_PUBKEY="$(cat /tmp/awcy/conf/awcy.pub)"
	xiph/awcy-worker:latest

docker run \
	-it \
	--detach \
	--name xiph-awcy-worker-2 \
	--volume ${HOME}/xiph-media-files:/media \
	--env SSH_PUBKEY="$(cat /tmp/awcy/conf/awcy.pub)"
	xiph/awcy-worker:latest

...
```

Note that the given public key is the server-generated one.

Then stop the server instance by hitting `CTRL+C` in its terminal.

Get IP addresses of your worker nodes:

```sh
docker inspect xiph-awcy-worker-1 | jq -r '.[].NetworkSettings.IPAddress'
172.20.0.12

docker inspect xiph-awcy-worker-2 | jq -r '.[].NetworkSettings.IPAddress'
172.20.0.13
...
```

You can now edit the /tmp/awcy/conf/machines.json (paths should be left as-is):

```
cat >/tmp/awcy/conf/machines.json <<EOF
[
  {
    "host": "172.20.0.12",
    "user": "xiph",
    "cores": 8,
    "port": 22,
    "work_root": "/data/work",
    "media_path": "/media"
  },
  {
    "host": "172.20.0.13",
    "user": "xiph",
    "cores": 8,
    "port": 22,
    "work_root": "/data/work",
    "media_path": "/media"
  }
]
EOF
```

Then start the server again using the previously used command.

You should now have two (or more) workers accessible.

Samples
----

To make sure that everything is working properly, you can try a run using the `awcy-builder-quicktest` set, which runs in one minute or so.

Cleanup
----

You can stop the container by hitting `CTRL+C`.

If you have started your container using the above example, all data is contained in `/tmp/awcy`, so you can removed this directory from your host.
