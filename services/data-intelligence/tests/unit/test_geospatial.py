from app.adapters.geospatial.local import haversine_km, point_in_polygon, stable_grid_cell


def test_polygon_containment_and_distance():
    polygon = [[75.73,26.86],[75.85,26.86],[75.85,26.97],[75.73,26.97]]
    assert point_in_polygon(26.9124,75.7873,polygon)
    assert not point_in_polygon(27.5,75.7873,polygon)
    assert haversine_km(26.9124,75.7873,26.9124,75.7873) == 0
    assert 100 < haversine_km(26.9124,75.7873,28.0,75.7873) < 130


def test_grid_cell_is_stable_and_resolution_sensitive():
    assert stable_grid_cell(26.9124,75.7873,3) == stable_grid_cell(26.9124,75.7873,3)
    assert stable_grid_cell(26.9124,75.7873,3) != stable_grid_cell(26.9124,75.7873,4)


def test_geography_resolution_priority(app):
    provider = app.state.pipeline.geography_provider
    by_coordinates = provider.resolve("IN",latitude=26.9124,longitude=75.7873,administrative_id="IN-RJ-JPR-W18",location_mentions=[])
    assert by_coordinates.geography_id == "IN-RJ-JPR-W42"
    by_id = provider.resolve("IN",latitude=None,longitude=None,administrative_id="IN-RJ-JPR-W18",location_mentions=["Ward 42"])
    assert by_id.geography_id == "IN-RJ-JPR-W18"
    by_mention = provider.resolve("IN",latitude=None,longitude=None,administrative_id=None,location_mentions=["Ward 42","Jaipur"])
    assert by_mention.geography_id == "IN-RJ-JPR-W42"
