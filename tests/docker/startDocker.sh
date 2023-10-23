#!/bin/bash

# Maximum number of attempts to bring down the Docker Compose
max_attempts=5

# Counter for the number of attempts
attempt=0

# Path to your docker-compose file
compose_file="tests/docker/docker-compose.yml"

# Function to bring up the services
start_services() {
    docker compose -f $compose_file up -d
}

# Loop to attempt 'docker compose down' with retries
while [ $attempt -lt $max_attempts ]; do
    # Increment the attempt counter
    ((attempt=attempt+1))

    # Try to bring down the services
    docker compose -f $compose_file down

    # Check if the command succeeded
    if [ $? -eq 0 ]; then
        echo "Successfully brought down the services."
        # If successful, break out of the loop
        break
    else
        echo "Attempt $attempt failed..."
        # If max attempts reached, show error and exit
        if [ $attempt -eq $max_attempts ]; then
            echo "Failed to bring down the services after $max_attempts attempts."
            exit 1
        fi
        # If not, wait for a bit before retrying
        echo "Retrying in 5 seconds..."
        sleep 5
    fi
done

# If we reached here, it means we successfully brought the services down.
# So we start them up again.
start_services
