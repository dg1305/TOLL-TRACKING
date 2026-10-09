export const PRODUCTS = ["ANAMAYA", "1.5T MRI", "3T MRI", "ACHIEVA 3T", "FPD", "Gamma Camera"]
export const CUSTOMER_TYPES = [
  "Hospital",
  "Diagnostic Centre",
  "Medical College",
  "Dealer",
  "Multispeciality Hospital",
  "Neurology Centre",
  "Polyclinic",
]
export const SITE_STATUSES = ["To Be Identified", "Under Preparation", "Ready"]
export const FUNDING_STATUSES = [
  "Not Yet Approached Bank",
  "Approached Bank",
  "Under Negotiation",
  "Ready",
  "DO/LC Received",
  "Self Funding",
]
export const PROCESS_STAGES = [
  { id: "new-enquiry", label: "New Enquiry", stage: "I", probability: 15 },
  { id: "need-analysis", label: "Need Analysis", stage: "I", probability: 22 },
  { id: "technical", label: "Technical Discussion", stage: "I", probability: 28 },
  { id: "quotation", label: "Proposal / Quotation", stage: "II", probability: 45 },
  { id: "negotiation", label: "Commercial Negotiation", stage: "III", probability: 70 },
  { id: "finalisation", label: "Finalisation", stage: "III", probability: 82 },
  { id: "order", label: "Order & Advance", stage: "IV", probability: 95 },
  { id: "booked", label: "Booked / Won", stage: "IV", probability: 100 },
]
export const PIPELINE_STAGES = [
  { id: "I", label: "Stage I", range: "0–30%", probability: 20 },
  { id: "II", label: "Stage II", range: "30–60%", probability: 45 },
  { id: "III", label: "Stage III", range: "60–90%", probability: 75 },
  { id: "IV", label: "Stage IV", range: ">90%", probability: 95 },
]
export const LOST_REASONS = [
  "Price",
  "Competitor",
  "Funding",
  "Project Cancelled",
  "Customer Delay",
  "Technical Requirement",
  "Other",
]
export const PRODUCT_MODALITY: Record<string, string> = {
  ANAMAYA: "MRI",
  "1.5T MRI": "MRI",
  "3T MRI": "MRI",
  "ACHIEVA 3T": "MRI",
  FPD: "Digital Radiography",
  "Gamma Camera": "Nuclear Medicine",
}

export const STATUS_BY_PROCESS: Record<string, string> = {
  "new-enquiry": "New Enquiry",
  "need-analysis": "Need Analysis",
  technical: "Technical Discussion",
  quotation: "Quotation Submitted",
  negotiation: "Commercial Negotiation",
  finalisation: "Finalisation",
  order: "Order & Advance",
  booked: "Booked",
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export function padId(n: number) {
  return "3I-FY26-" + String(n).padStart(4, "0")
}

export function weightedValue(opp: { value?: number; probability?: number }) {
  return ((Number(opp.value) || 0) * (Number(opp.probability) || 0)) / 100
}

export function processMeta(id: string) {
  return PROCESS_STAGES.find((s) => s.id === id)
}

export type ClientOpp = Record<string, unknown> & {
  id: string
  customer: string
  location?: string
  region?: string
  regionKey?: string
  customerType?: string
  modality?: string
  product?: string
  value?: number
  siteStatus?: string
  fundingStatus?: string
  expectedClosure?: string
  expectedClosureLabel?: string
  salesStatus?: string
  stage?: string
  probability?: number
  processStage?: string
  owner?: string
  remarks?: string[]
  activities?: { date?: string; title?: string; note?: string }[]
  createdAt?: string
  lastUpdated?: string
  outcome?: string
  lostReason?: string
  competitor?: string
  dateLost?: string
  dataIssues?: string[]
}

export function applyStageChange(opp: ClientOpp, processId: string) {
  const now = todayISO()
  if (processId === "lost") {
    Object.assign(opp, { outcome: "lost", salesStatus: "Lost", probability: 0, processStage: "lost", lastUpdated: now })
    return opp
  }
  if (processId === "cancelled") {
    Object.assign(opp, {
      outcome: "cancelled",
      salesStatus: "Cancelled",
      probability: 0,
      processStage: "cancelled",
      lastUpdated: now,
    })
    return opp
  }
  const meta = processMeta(processId)
  if (!meta) return opp
  opp.processStage = processId
  opp.stage = meta.stage
  opp.probability = meta.probability
  opp.salesStatus = STATUS_BY_PROCESS[processId] || meta.label
  opp.lastUpdated = now
  if (processId === "booked") {
    opp.outcome = "booked"
    opp.probability = 100
  } else {
    opp.outcome = "open"
  }
  return opp
}

export function filterOpps(opps: ClientOpp[], q: Record<string, unknown> = {}) {
  return opps.filter((o) => {
    if (q.region && q.region !== "all" && o.regionKey !== q.region) return false
    if (q.owner && o.owner !== q.owner) return false
    if (q.product && o.product !== q.product) return false
    if (q.stage && o.stage !== q.stage) return false
    if (q.status && o.salesStatus !== q.status) return false
    if (q.outcome && o.outcome !== q.outcome) return false
    if (q.funding && o.fundingStatus !== q.funding) return false
    if (q.site && o.siteStatus !== q.site) return false
    if (q.processStage && o.processStage !== q.processStage) return false
    if (q.search) {
      const blob = `${o.id} ${o.customer} ${o.location} ${o.product} ${o.owner}`.toLowerCase()
      if (!blob.includes(String(q.search).toLowerCase())) return false
    }
    return true
  })
}

export function qualityReport(opps: ClientOpp[]) {
  const issues: { id: string; customer: string; type: string; detail: string }[] = []
  let missing = 0
  let inconsistent = 0
  opps.forEach((o) => {
    if (!o.value) {
      missing++
      issues.push({ id: o.id, customer: o.customer, type: "Missing value", detail: "Opportunity value not recorded" })
    }
    if (!o.siteStatus) missing++
    if (!o.fundingStatus) missing++
    if (!o.expectedClosure) missing++
    ;(o.dataIssues || []).forEach((d) => {
      inconsistent++
      issues.push({ id: o.id, customer: o.customer, type: "Inconsistent data", detail: d })
    })
  })
  const score = Math.max(52, Math.min(88, Math.round(100 - ((missing + inconsistent * 1.2) / Math.max(opps.length, 1)) * 12)))
  return { score, issuesFound: issues.length, missing, inconsistent, issues: issues.slice(0, 40) }
}
