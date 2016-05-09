
bash:
	docker run -it --rm \
    	-v "`pwd`":/app/ \
    	-w /app \
    	node:4 /bin/bash

test:
	mocha source/test
	