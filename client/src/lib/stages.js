export const STAGE_LABELS = {
  "new-enquiry": "New Enquiry",
  "need-analysis": "Need Analysis",
  technical: "Technical Discussion",
  quotation: "Proposal / Quotation",
  negotiation: "Commercial Negotiation",
  finalisation: "Finalisation",
  order: "Order & Advance",
  booked: "Booked / Won",
  lost: "Lost",
  cancelled: "Cancelled",
};

export const STAGE_ORDER = [
  "new-enquiry",
  "need-analysis",
  "technical",
  "quotation",
  "negotiation",
  "finalisation",
  "order",
  "booked",
  "lost",
  "cancelled",
];

export const TRACKER_STAGES = [
  "new-enquiry",
  "need-analysis",
  "technical",
  "quotation",
  "negotiation",
  "finalisation",
  "order",
  "booked",
];

export function trackerSteps(item) {
  const current = String(item?.processStage || "new-enquiry");
  if (current === "lost" || current === "cancelled") {
    return [
      ...TRACKER_STAGES.map((id) => ({ id, status: "completed" })),
      { id: current, status: "inprogress" },
    ];
  }
  const idx = Math.max(0, TRACKER_STAGES.indexOf(current));
  return TRACKER_STAGES.map((id, i) => ({
    id,
    status: i < idx ? "completed" : i === idx ? "inprogress" : "pending",
  }));
}

export function statusTone(status) {
  const s = String(status || "").toLowerCase();
  if (s.includes("book") || s.includes("won") || s.includes("order")) return "label-success";
  if (s.includes("lost") || s.includes("cancel")) return "label-danger";
  if (s.includes("negot") || s.includes("final")) return "label-warning";
  if (s.includes("quot") || s.includes("proposal")) return "label-info";
  return "label-primary";
}
