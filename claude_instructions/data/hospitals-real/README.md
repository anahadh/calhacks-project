# Real HSE acute hospitals (2021 hospital-group structure)

Files: `hse_acute_hospitals_2021.csv` and `hse_acute_hospitals_2021.geojson` (same 49 rows; GeoJSON points are [lon, lat], WGS84).

Columns: id (H01–H49, our own ids), name, hospital_group_2021, lat, lon, wiki_title, source_url, provenance (always `P`, public source), note.

Counts by group: Ireland East 11, South/South West 9, RCSI 7, Saolta 7, Dublin Midlands 6, UL 6, Children's Health Ireland 3.

## Sources (fetched 24 Oct 2026)
- Group membership: the "given responsibility for the following hospitals" lists in the Wikipedia articles for each of the six HSE hospital groups (Dublin Midlands, Ireland East, RCSI, Saolta, UL, South/Southwest) plus Children's Health Ireland. These reflect the 2013–2024 group structure, i.e. what existed in May 2021.
- Coordinates: the `{{coord}}` in each hospital's Wikipedia infobox.
- Licence: Wikipedia text and data are CC BY-SA 4.0. Credit "Wikipedia contributors" in the app's sources panel.

## Why not data.gov.ie
data.gov.ie is reachable now, but neither the Department of Health "Location of Group Hospitals" dataset nor the HSE "List of hospitals in Ireland" dataset exists any more (package_show returns Not Found; no match among 22,931 packages in package_list). The only Dept of Health hospital CSV still listed is a national COVID aggregate with no per-hospital rows.

## Known caveats
- 49 rows, not 54. The "54 acute hospitals" figure also counts sites folded into others here (e.g. Cork University Maternity Hospital inside CUH, St Luke's Radiation Oncology Network). Add them by hand if the map needs exactly 54.
- CHI at Tallaght (H49) uses Tallaght University Hospital's coordinates, because the Wikipedia article's coordinates are the old pre-1998 Harcourt St site.
- Hospital groups were replaced by HSE Health Regions in 2024; this file deliberately keeps the 2021 groups.
- No PwC letter (A–N) is or should be mapped to any of these rows.
