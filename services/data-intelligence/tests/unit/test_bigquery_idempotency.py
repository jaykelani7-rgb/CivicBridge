from app.adapters.bigquery.idempotency import BigQueryDeliveryIdempotencyStore


class Parameter:
    def __init__(self, name, kind, value):
        self.name, self.value = name, value


class QueryJobConfig:
    def __init__(self, query_parameters):
        self.query_parameters = query_parameters


class FakeBigQuery:
    ScalarQueryParameter = Parameter
    QueryJobConfig = QueryJobConfig


class Job:
    def __init__(self, rows):
        self.rows = rows

    def result(self):
        return self.rows


class Client:
    def __init__(self):
        self.events = {}

    def query(self, query, *, job_config, location):
        values = {item.name: item.value for item in job_config.query_parameters}
        event_id = values["event_id"]
        if "MERGE" in query:
            current = self.events.get(event_id)
            if current is None or current["status"] == "failed":
                current = {"status": "processing", "claim_token": values["claim_token"]}
                self.events[event_id] = current
            return Job([current.copy()])
        self.events[event_id]["status"] = values["status"]
        self.events[event_id]["error_code"] = values["error_code"]
        return Job([])


def store(client):
    return BigQueryDeliveryIdempotencyStore(
        "project", "dataset", "us-central1", client=client, bigquery_module=FakeBigQuery
    )


def test_completed_event_is_a_durable_duplicate():
    client = Client()
    ledger = store(client)
    first = ledger.begin("event-1", "request.normalized.v1", "request-1", "1.0.0")
    assert first.acquired is True
    ledger.complete("event-1")
    duplicate = ledger.begin("event-1", "request.normalized.v1", "request-1", "1.0.0")
    assert duplicate.acquired is False
    assert duplicate.duplicate is True


def test_processing_event_cannot_be_claimed_twice():
    client = Client()
    ledger = store(client)
    assert ledger.begin(
        "event-1", "request.normalized.v1", "request-1", "1.0.0"
    ).acquired
    second = ledger.begin("event-1", "request.normalized.v1", "request-1", "1.0.0")
    assert second.acquired is False
    assert second.duplicate is False


def test_failed_event_can_be_retried():
    client = Client()
    ledger = store(client)
    ledger.begin("event-1", "request.normalized.v1", "request-1", "1.0.0")
    ledger.fail("event-1", "DEPENDENCY_UNAVAILABLE")
    assert ledger.begin(
        "event-1", "request.normalized.v1", "request-1", "1.0.0"
    ).acquired
