/* qc-sample-data.js: MADE-UP buildings, rework and change orders from the kit (sample-data.json).
   Adjusted from the kit: every building here is already built and out of the plant, at a
   different point in its QC check, and the rework items use the real checklist wording.
   model_image is a still picture rendered from the Sales Desk 3D model for that style, in the
   building's siding, trim and roof colors. Replace this file with a feed
   from the production system in a live version.    order_options is what the sale would carry (windows, doors, electrical, shutters). It feeds
   the build sheet, the 3D model and the questions that do not apply.
   sales_order links a building to an order on the Sales desk side. */
const QC_SAMPLE = {
 "builds": [
  {
   "serial": "SAMPLE-1016-1001",
   "size": "10x16",
   "style": "Classic Utility",
   "siding_color": "Clay",
   "trim_color": "Origami White",
   "roof": "Architectural shingles",
   "dealer": "Bennett Buildings of Moncks Corner",
   "stage": "QC",
   "qc_status": "Ready for QA",
   "days_in_stage": 0,
   "model_image": "./SAMPLE-1016-1001.webp",
   "order_options": {
    "windows": 1,
    "electrical": "Basic",
    "shutters": false,
    "door": "Double"
   },
   "sales_order": "B0",
   "customer": "Taylor Reed"
  },
  {
   "serial": "SAMPLE-1220-1002",
   "size": "12x20",
   "style": "Classic Lofted Barn",
   "siding_color": "Sage Green",
   "trim_color": "Origami White",
   "roof": "Metal",
   "dealer": "Bennett Buildings of Statesboro",
   "stage": "QC",
   "qc_status": "Ready for QA",
   "days_in_stage": 0,
   "model_image": "./SAMPLE-1220-1002.webp",
   "order_options": {
    "windows": 2,
    "electrical": "None",
    "shutters": false,
    "door": "Double"
   }
  },
  {
   "serial": "SAMPLE-812-1003",
   "size": "8x12",
   "style": "Basic Utility",
   "siding_color": "Dovetail Grey",
   "trim_color": "Origami White",
   "roof": "Metal",
   "dealer": "Bennett Buildings of Vidalia",
   "stage": "QC",
   "qc_status": "Ready for QA",
   "days_in_stage": 1,
   "model_image": "./SAMPLE-812-1003.webp",
   "order_options": {
    "windows": 0,
    "electrical": "None",
    "shutters": false,
    "door": "Single"
   }
  },
  {
   "serial": "SAMPLE-1020-1004",
   "size": "10x20",
   "style": "Elite Utility",
   "siding_color": "Alpine Grey",
   "trim_color": "Origami White",
   "roof": "Architectural shingles",
   "dealer": "Bennett Buildings of Moncks Corner",
   "stage": "QC",
   "qc_status": "Ready for QA",
   "days_in_stage": 1,
   "model_image": "./SAMPLE-1020-1004.webp",
   "order_options": {
    "windows": 2,
    "electrical": "Basic",
    "shutters": true,
    "door": "Double"
   }
  },
  {
   "serial": "SAMPLE-1224-1005",
   "size": "12x24",
   "style": "Classic Utility",
   "siding_color": "Black",
   "trim_color": "Origami White",
   "roof": "Metal",
   "dealer": "Bennett Buildings of Statesboro",
   "stage": "QC",
   "qc_status": "In rework",
   "days_in_stage": 2,
   "model_image": "./SAMPLE-1224-1005.webp",
   "order_options": {
    "windows": 2,
    "electrical": "Expanded",
    "shutters": false,
    "door": "Double"
   }
  },
  {
   "serial": "SAMPLE-1012-1006",
   "size": "10x12",
   "style": "Silver Bullet",
   "siding_color": "Blue",
   "trim_color": "Origami White",
   "roof": "Metal",
   "dealer": "Bennett Buildings of Vidalia",
   "stage": "QC",
   "qc_status": "In QA",
   "days_in_stage": 0,
   "model_image": "./SAMPLE-1012-1006.webp",
   "order_options": {
    "windows": 0,
    "electrical": "Basic",
    "shutters": false,
    "door": "Double"
   }
  },
  {
   "serial": "SAMPLE-810-1007",
   "size": "8x10",
   "style": "Basic Studio",
   "siding_color": "Web Grey",
   "trim_color": "Origami White",
   "roof": "Architectural shingles",
   "dealer": "Bennett Buildings of Moncks Corner",
   "stage": "QC",
   "qc_status": "Ready for QA",
   "days_in_stage": 2,
   "model_image": "./SAMPLE-810-1007.webp",
   "order_options": {
    "windows": 1,
    "electrical": "Lights Only",
    "shutters": false,
    "door": "Single"
   }
  },
  {
   "serial": "SAMPLE-1232-1008",
   "size": "12x32",
   "style": "Classic Lofted Barn",
   "siding_color": "Clay",
   "trim_color": "Origami White",
   "roof": "Metal",
   "dealer": "Bennett Buildings of Statesboro",
   "stage": "QC",
   "qc_status": "Needs sign-off",
   "days_in_stage": 1,
   "model_image": "./SAMPLE-1232-1008.webp",
   "order_options": {
    "windows": 3,
    "electrical": "Utility",
    "shutters": true,
    "door": "Double"
   }
  },
  {
   "serial": "SAMPLE-1016-1009",
   "size": "10x16",
   "style": "Basic Lofted Barn",
   "siding_color": "Sage Green",
   "trim_color": "Origami White",
   "roof": "Metal",
   "dealer": "Bennett Buildings of Vidalia",
   "stage": "QC",
   "qc_status": "On hold",
   "days_in_stage": 4,
   "model_image": "./SAMPLE-1016-1009.webp",
   "order_options": {
    "windows": 1,
    "electrical": "None",
    "shutters": false,
    "door": "Double"
   }
  },
  {
   "serial": "SAMPLE-1216-1010",
   "size": "12x16",
   "style": "Elite Utility",
   "siding_color": "Dovetail Grey",
   "trim_color": "Origami White",
   "roof": "Architectural shingles",
   "dealer": "Bennett Buildings of Moncks Corner",
   "stage": "QC",
   "qc_status": "Ready for QA",
   "days_in_stage": 1,
   "model_image": "./SAMPLE-1216-1010.webp",
   "order_options": {
    "windows": 2,
    "electrical": "Basic",
    "shutters": false,
    "door": "Double"
   }
  },
  {
   "serial": "SAMPLE-1024-1011",
   "size": "10x24",
   "style": "Classic Utility",
   "siding_color": "Alpine Grey",
   "trim_color": "Origami White",
   "roof": "Metal",
   "dealer": "Bennett Buildings of Statesboro",
   "stage": "QC",
   "qc_status": "In rework",
   "days_in_stage": 3,
   "model_image": "./SAMPLE-1024-1011.webp",
   "order_options": {
    "windows": 2,
    "electrical": "Expanded",
    "shutters": false,
    "door": "Double"
   }
  },
  {
   "serial": "SAMPLE-1428-1012",
   "size": "14x28",
   "style": "Classic Lofted Barn",
   "siding_color": "Black",
   "trim_color": "Origami White",
   "roof": "Metal",
   "dealer": "Bennett Buildings of Vidalia",
   "stage": "Ready to ship",
   "qc_status": "Signed off",
   "days_in_stage": 0,
   "model_image": "./SAMPLE-1428-1012.webp",
   "order_options": {
    "windows": 2,
    "electrical": "Basic",
    "shutters": true,
    "door": "Double"
   }
  }
 ],
 "rework": [
  {
   "id": "RW-1",
   "serial": "SAMPLE-1024-1011",
   "stage": "QC",
   "item": "Is the floor square?",
   "defect": "Gap or poor fit",
   "note": "Diagonals out by 5/8 in.",
   "assigned_to": null,
   "step": "Failed",
   "opened_hours_ago": 20
  },
  {
   "id": "RW-2",
   "serial": "SAMPLE-1224-1005",
   "stage": "QC",
   "item": "Are the window type, size and location correct?",
   "defect": "Wrong size or position",
   "note": "Window framed on the right wall; order says left.",
   "assigned_to": "Wall crew",
   "step": "Fixed",
   "opened_hours_ago": 44
  },
  {
   "id": "RW-3",
   "serial": "SAMPLE-1024-1011",
   "stage": "QC",
   "item": "Is the proper electrical package or components installed?",
   "defect": "Electrical",
   "note": "Order is Expanded (3 outlets); only 1 outlet fitted.",
   "assigned_to": null,
   "step": "Failed",
   "opened_hours_ago": 6
  }
 ],
 "hold_reasons": {
  "SAMPLE-1016-1009": "Waiting on material"
 }
};
