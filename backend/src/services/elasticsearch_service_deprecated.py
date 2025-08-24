# DEPRECATED: Elasticsearch service removed in favor of Meilisearch
# This service has been deprecated to simplify search architecture
# Use Meilisearch for all search operations instead

import logging
logger = logging.getLogger(__name__)

logger.warning(
    "Elasticsearch service has been deprecated. "
    "All search operations now use Meilisearch for better performance and simplicity."
)