FROM pgvector/pgvector:pg17

# Determine the sharedir using pg_config and copy the stop words file
COPY tsearch_data/vietnamese.stop /tmp/vietnamese.stop

# Install file with correct permissions
RUN install -o postgres -g postgres -m 0644 /tmp/vietnamese.stop "$(pg_config --sharedir)/tsearch_data/vietnamese.stop" && rm /tmp/vietnamese.stop
