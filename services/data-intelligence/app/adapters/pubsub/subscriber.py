from __future__ import annotations

from app.domain.errors import DependencyError


class PubSubNormalizedSubscriber:
    """Production subscription bootstrap around the adapter-neutral consumer callback."""

    def __init__(self, project: str, subscription: str, consumer) -> None:
        try:
            from google.cloud import pubsub_v1
        except ImportError as exc:
            raise DependencyError("Install the production extra to use Pub/Sub.") from exc
        self.client = pubsub_v1.SubscriberClient()
        self.subscription_path = self.client.subscription_path(project,subscription)
        self.consumer = consumer

    def start(self):
        return self.client.subscribe(self.subscription_path,callback=self.consumer.pubsub_callback)
