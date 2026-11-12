/* =====================================================================================
   qc-config.js  ·  EDIT HERE
   Checklists, defect types, hold reasons, crews and people all live in this one file.
   Change the words here and every screen picks them up. Nothing in qc-app.js needs
   touching.

   Where this came from:
   - The checklist items are the active items from the plant's current QC checklist
     export (qc-checklist-data.xlsx), each reworded as a question answered Yes, No or N/A.
     Keep every question worded so that YES is the good answer. "No" opens a failure.
   - Buildings are QC checked once, after they are built and pulled out of the plant.
     The questions are grouped under the QC tiles (Flooring, Walls, Paint, Roofing,
     Final QA). Which tile a section sits under is a FIRST DRAFT: move a section, or a
     single question, to another tile to change it.
   - Left out: "free of shiners" (GENERAL). It repeats "No visible shiners" under Walls.
   - Defect types are a draft. The current system has no defect types, so these were
     written from the notes inspectors typed on real failures.
   ===================================================================================== */
const QC_CONFIG = {
  /* The tiles on every building show how far its QC CHECK has got, not how far it is built.
     There is one tile per group below, in this order, plus the last tile, which turns green
     when the building is signed off. A tile is grey until its questions are answered, navy
     when they are all Yes or N/A, and red while one of them has an open failure. */
  shipTile: "Ready to ship",

  /* tile -> sections -> questions. Draft: which tile each section sits under is a guess to correct. */
  checklists: {
    "Flooring": [
      { section: "Floor", items: [
        "Are the runners spaced correctly?",
        "Is the floor square?",
        "Is the floor sheeting free of unacceptable gaps?",
        "Are the nails flush and spaced correctly?",
        "Is the floor free of discoloration and scuffing?",
      ] },
    ],
    "Walls": [
      { section: "Walls", items: [
        "Are the studs the correct height and uniform?",
        "Is the baseplate nailed properly?",
        "Are the nails flush and spaced correctly?",
        "Are the top-plate corners and joints free of gaps?",
        "Are the walls free of visible shiners?",
        "Is the visible wood of high quality?",
      ] },
      { section: "Trusses, roof deck and door", items: [
        "Are the joist and truss joints free of gaps?",
        "Are the top plate Simpson screws installed?",
        "Are the nails flush and spaced correctly?",
        "Is the door built properly?",
      ] },
      { section: "Siding, doors and windows", items: [
        "Is the siding the correct type?",
        "Is the siding nailed properly, clean and free of gaps?",
        "Are the door type, size and location correct?",
        "Are the window type, size and location correct?",
      ] },
    ],
    "Paint": [
      { section: "Paint and finish", items: [
        "Is the color the correct paint or urethane per the build sheet?",
        "Is the paint coverage complete?",
        "Is the paint free of runs and sags?",
        "Is the building free of paint overspray?",
        "Is the bottom of the trim painted?",
        "Is the urethane uniform? (if applicable)",
        "Is the paint touched up?",
      ] },
      { section: "Trim", items: [
        "Is the trim the correct color?",
        "Is the trim installed properly?",
        "Is there silicone on the doors?",
        "Is there silicone on the windows?",
        "Is there silicone on the vents?",
        "Is there silicone on the trim above the door?",
      ] },
    ],
    "Roofing": [
      { section: "Roofing", items: [
        "Is the roof the correct color and material?",
        "Is the roofing clean and uniform, with correct screw spacing?",
      ] },
    ],
    "Final QA": [
      { section: "Building information", items: [
        "Is the serial number verified?",
        "Is the serial number written on the top plate above the door?",
        "Are all build sheet items present?",
      ] },
      { section: "Electrical", items: [
        "Is the proper electrical package or components installed?",
        "Are all receptacles, lights, switches and breaker boxes (if required) installed in the correct location?",
        "Is the pigtail mounted properly?",
      ] },
      { section: "Options", items: [
        "Do the doors and windows work properly with no gaps?",
        "Are the shelves and workbenches installed? (if required)",
        "Are the shutters installed correctly? (if required)",
      ] },
      { section: "Final QC", items: [
        "Is the visible wood of acceptable quality?",
        "Are builder markings erased or hidden?",
        "Is the building cleaned out and free of sawdust and debris?",
        "Are the keys in the building?",
        "Are the touch-up cans in the building and secured?",
      ] },
    ],
  },

  /* Draft. Questions that do not apply to an order are left out of its checklist.
     `when` gets the order's setup from the sale (style, windows, electrical, shutters...). */
  skipWhen: [
    {
      why: "No electrical on this order",
      when: (c) => !c.electrical || c.electrical === "None",
      questions: [
        "Is the proper electrical package or components installed?",
        "Are all receptacles, lights, switches and breaker boxes (if required) installed in the correct location?",
        "Is the pigtail mounted properly?",
      ],
    },
    {
      why: "No shutters on this order",
      when: (c) => !c.shutters,
      questions: ["Are the shutters installed correctly? (if required)"],
    },
    {
      why: "No windows on this order",
      when: (c) => !Number(c.windows) && !c.package,
      questions: ["Are the window type, size and location correct?", "Is there silicone on the windows?"],
    },
    {
      why: "Metal building, nothing painted at the plant",
      when: (c) => c.style === "Silver Bullet",
      questions: [
        "Is the color the correct paint or urethane per the build sheet?",
        "Is the paint coverage complete?",
        "Is the paint free of runs and sags?",
        "Is the building free of paint overspray?",
        "Is the bottom of the trim painted?",
        "Is the urethane uniform? (if applicable)",
        "Is the paint touched up?",
        "Are the walls free of visible shiners?",
      ],
    },
  ],

  /* Draft. A photo is required on every failure except for these questions, where a photo
     proves nothing. */
  photoNotNeeded: [
    "Is the serial number verified?",
    "Is the serial number written on the top plate above the door?",
    "Are all build sheet items present?",
    "Are the keys in the building?",
    "Are the touch-up cans in the building and secured?",
  ],

  /* Draft. One tap picks one of these when an item fails. */
  defectTypes: [
    "Silicone missing",
    "Shiners or nails",
    "Gap or poor fit",
    "Paint or finish flaw",
    "Wrong color",
    "Wrong size or position",
    "Wood quality",
    "Missing item or option",
    "Roof screws or metal",
    "Electrical",
    "Damage or rust",
    "Paperwork or serial",
  ],

  /* Draft. Reasons offered when a building is put on hold. */
  holdReasons: ["Waiting on material", "Waiting on a change order", "Waiting on a decision", "Other"],

  /* Draft. Rework starts unassigned; the QC lead can assign it to one of these. */
  crews: ["Floor crew", "Wall crew", "Paint crew", "Roof crew", "Electrical", "Finish crew"],

  /* Made-up people for the preview. A live version would use logins instead. */
  people: [
    { name: "Riley Carter", role: "Inspector" },
    { name: "Morgan Hayes", role: "Inspector" },
    { name: "Avery Brooks", role: "QC lead" },
    { name: "Casey Dunn", role: "Plant manager" },
  ],

  reworkSteps: ["Failed", "Fixed", "Re-inspected"],
  changeOrderSteps: ["Requested by manager", "Approved by admin", "Acknowledged by plant"],
};
