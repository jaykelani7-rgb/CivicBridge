from typing import Dict, Any, List

COUNTRY_PACKS: Dict[str, Dict[str, Any]] = {
    "IN": {
        "country_code": "IN",
        "country_name": "India",
        "supported_languages": [
            {"code": "en", "label": "English"},
            {"code": "hi", "label": "Hindi (हिंदी)"}
        ],
        "currency": {
            "code": "INR",
            "symbol": "₹",
            "format": "₹{val:,}"
        },
        "administrative_levels": {
            "levels": [
                {"level": 0, "name": "Country"},
                {"level": 1, "name": "State"},
                {"level": 2, "name": "District"},
                {"level": 3, "name": "Ward"}
            ],
            "boundary_source": "Open Government Data Platform India"
        },
        "taxonomy": {
            "categories": [
                "water", "sanitation", "roads", "drainage", "electricity", 
                "connectivity", "transport", "health", "education", "waste", "other"
            ],
            "subcategories": {
                "water": ["leakage", "contamination", "low_pressure", "no_supply", "tanker_delay"],
                "sanitation": ["toilet_blockage", "sewer_overflow", "public_toilet_needed"],
                "roads": ["pothole", "street_lighting_failure", "waterlogging", "footpath_damaged"],
                "drainage": ["clogged_drain", "drain_overflow", "open_drainage"],
                "electricity": ["power_cut", "voltage_fluctuation", "hanging_wire", "transformer_fault"],
                "connectivity": ["no_network", "slow_internet", "digital_center_closed"],
                "transport": ["bus_frequency_low", "no_bus_stop", "traffic_congestion"],
                "health": ["clinic_closed", "medicine_shortage", "staff_unavailable"],
                "education": ["school_building_repair", "no_drinking_water_school", "teacher_absent"],
                "waste": ["garbage_pile", "delayed_pickup", "no_bin"],
                "other": ["miscellaneous"]
            }
        },
        "score_weights": {
            "version": "1.0.0",
            "weights": {
                "DemandRate": 0.25,
                "InfrastructureGap": 0.20,
                "Severity": 0.15,
                "EquityAndVulnerability": 0.15,
                "AffectedPopulation": 0.10,
                "RecentTrend": 0.10,
                "EvidenceConfidence": 0.05
            },
            "action_weights": {
                "NeedScore": 0.60,
                "StrategicAlignment": 0.20,
                "DeliveryReadiness": 0.10,
                "DataConfidence": 0.10,
                "ExistingCoveragePenalty": 1.0
            }
        },
        "privacy": {
            "min_reports_threshold": 5,
            "retention_days_media": 90,
            "retention_days_pii": 30
        }
    },
    "BR": {
        "country_code": "BR",
        "country_name": "Brazil",
        "supported_languages": [
            {"code": "pt", "label": "Portuguese (Português)"},
            {"code": "en", "label": "English"}
        ],
        "currency": {
            "code": "BRL",
            "symbol": "R$",
            "format": "R${val:,}"
        },
        "administrative_levels": {
            "levels": [
                {"level": 0, "name": "Country"},
                {"level": 1, "name": "State"},
                {"level": 2, "name": "Municipality"},
                {"level": 3, "name": "District/Bairro"}
            ],
            "boundary_source": "Brazil national open-data portal dados.gov.br"
        },
        "taxonomy": {
            "categories": [
                "water", "sanitation", "roads", "drainage", "electricity", 
                "connectivity", "transport", "health", "education", "waste", "other"
            ],
            "subcategories": {
                "water": ["vazamento", "agua_contaminada", "falta_de_agua", "pressao_baixa"],
                "sanitation": ["esgoto_entupido", "vazamento_de_esgoto", "banheiro_publico_necessario"],
                "roads": ["buraco", "falta_de_iluminacao", "alagamento", "calcada_danificada"],
                "drainage": ["bueiro_entupido", "valeta_aberta", "inundacao"],
                "electricity": ["falta_de_energia", "oscilacao_de_tensao", "fio_caido", "transformador_com_defeito"],
                "connectivity": ["sem_sinal", "internet_lenta", "inclusao_digital_fechado"],
                "transport": ["poucos_onibus", "falta_de_ponto_de_onibus", "transito_intenso"],
                "health": ["posto_de_saude_fechado", "falta_de_remedio", "falta_de_medicos"],
                "education": ["reforma_de_escola", "falta_de_agua_na_escola", "falta_de_professor"],
                "waste": ["lixo_acumulado", "atraso_na_coleta", "falta_de_lixeira"],
                "other": ["diversos"]
            }
        },
        "score_weights": {
            "version": "1.0.0",
            "weights": {
                "DemandRate": 0.25,
                "InfrastructureGap": 0.20,
                "Severity": 0.15,
                "EquityAndVulnerability": 0.15,
                "AffectedPopulation": 0.10,
                "RecentTrend": 0.10,
                "EvidenceConfidence": 0.05
            },
            "action_weights": {
                "NeedScore": 0.60,
                "StrategicAlignment": 0.20,
                "DeliveryReadiness": 0.10,
                "DataConfidence": 0.10,
                "ExistingCoveragePenalty": 1.0
            }
        },
        "privacy": {
            "min_reports_threshold": 5,
            "retention_days_media": 90,
            "retention_days_pii": 30
        }
    },
    "ZA": {
        "country_code": "ZA",
        "country_name": "South Africa",
        "supported_languages": [
            {"code": "en", "label": "English"},
            {"code": "xh", "label": "isiXhosa"},
            {"code": "zu", "label": "isiZulu"}
        ],
        "currency": {
            "code": "ZAR",
            "symbol": "R",
            "format": "R{val:,}"
        },
        "administrative_levels": {
            "levels": [
                {"level": 0, "name": "Country"},
                {"level": 1, "name": "Province"},
                {"level": 2, "name": "Municipality"},
                {"level": 3, "name": "Ward"}
            ],
            "boundary_source": "Statistics South Africa"
        },
        "taxonomy": {
            "categories": [
                "water", "sanitation", "roads", "drainage", "electricity", 
                "connectivity", "transport", "health", "education", "waste", "other"
            ],
            "subcategories": {
                "water": ["leakage", "contamination", "no_water_supply", "water_shedding", "communal_tap_broken"],
                "sanitation": ["sewage_spill", "unserviceable_toilet", "bucket_system_removal"],
                "roads": ["pothole", "gravel_road_grading", "street_light_broken", "no_sidewalks"],
                "drainage": ["blocked_stormwater", "flooding_risk", "canal_maintenance"],
                "electricity": ["loadshedding_damage", "illegal_connection", "cable_theft", "substation_failure"],
                "connectivity": ["no_signal", "wifi_hotspot_down", "telecentre_closed"],
                "transport": ["taxi_rank_upgrade", "bus_stop_needed", "unsafe_crossing"],
                "health": ["clinic_staff_shortage", "long_waiting_times", "ambulance_delay"],
                "education": ["pit_latrine_elimination", "classroom_overcrowding", "no_fencing"],
                "waste": ["illegal_dumping", "uncollected_refuse", "wheelie_bin_request"],
                "other": ["general_inquiry"]
            }
        },
        "score_weights": {
            "version": "1.0.0",
            "weights": {
                "DemandRate": 0.25,
                "InfrastructureGap": 0.20,
                "Severity": 0.15,
                "EquityAndVulnerability": 0.15,
                "AffectedPopulation": 0.10,
                "RecentTrend": 0.10,
                "EvidenceConfidence": 0.05
            },
            "action_weights": {
                "NeedScore": 0.60,
                "StrategicAlignment": 0.20,
                "DeliveryReadiness": 0.10,
                "DataConfidence": 0.10,
                "ExistingCoveragePenalty": 1.0
            }
        },
        "privacy": {
            "min_reports_threshold": 5,
            "retention_days_media": 90,
            "retention_days_pii": 30
        }
    }
}
