export type MdmGovernanceDomain = 'organization' | 'partner' | 'logistics' | 'asset' | 'material'
export type MdmSeverity = 'low' | 'medium' | 'high' | 'critical'
export type MdmQualityIssueState =
  'open' | 'in_progress' | 'pending_verification' | 'resolved' | 'waived' | 'reopened'
export type MdmChangeRequestState =
  'draft' | 'submitted' | 'approved' | 'rejected' | 'published' | 'cancelled'
export type MdmMatchCandidateState = 'pending' | 'accepted' | 'rejected' | 'superseded'
export type MdmOutboxDeliveryState =
  'pending' | 'processing' | 'retry' | 'delivered' | 'dead_letter'

export interface MdmGovernancePageQuery {
  current: number
  size: number
  keyword?: string
  state?: string
  severity?: MdmSeverity | ''
}

export interface MdmQualityIssue {
  id: string
  domainKey: MdmGovernanceDomain
  sourceType: string
  sourceRecordId: string
  sourceCode: string | null
  sourceName: string
  severity: MdmSeverity
  state: MdmQualityIssueState
  observedStatus: 'failing' | 'passing' | 'unknown'
  detectedDetails: Record<string, unknown>
  firstDetectedAt: string
  lastDetectedAt: string
  dueAt: string
  detectionCount: number
  resolutionSummary: string | null
  updateTime: string
}

export interface MdmChangeRequest {
  id: string
  requestNo: string
  domainKey: MdmGovernanceDomain
  sourceType: string
  sourceRecordId: string | null
  operation: 'create' | 'update' | 'enable' | 'disable' | 'retire' | 'merge'
  title: string
  reason: string
  beforeData: Record<string, unknown> | null
  proposedData: Record<string, unknown>
  state: MdmChangeRequestState
  version: number
  effectiveAt: string
  requesterEmail: string
  reviewerEmail: string | null
  reviewComment: string | null
  publisherEmail: string | null
  createTime: string
  updateTime: string
}

export interface MdmChangeRequestInput {
  domainKey: MdmGovernanceDomain
  sourceType: string
  sourceRecordId: string | null
  operation: MdmChangeRequest['operation']
  title: string
  reason: string
  beforeData: Record<string, unknown> | null
  proposedData: Record<string, unknown>
  effectiveAt: string
}

export interface MdmMatchCandidate {
  id: string
  domainKey: MdmGovernanceDomain
  sourceType: string
  leftRecordId: string
  rightRecordId: string
  matchScore: number
  matchBasis: Record<string, unknown>
  state: MdmMatchCandidateState
  reviewedAt: string | null
  reviewComment: string | null
  createTime: string
}

export interface MdmOutboxDelivery {
  id: string
  eventId: string
  consumerId: string
  status: MdmOutboxDeliveryState
  attempts: number
  availableAt: string
  lockedAt: string | null
  lockedBy: string | null
  deliveredAt: string | null
  lastError: string | null
  createTime: string
  event?: {
    eventType: string
    aggregateType: string
    aggregateId: string
    eventVersion: number
    occurredAt: string
  }
  consumer?: {
    consumerKey: string
    consumerName: string
    contractVersion: number
  }
}

export interface MdmGovernanceOverview {
  stewards: number
  activeRules: number
  openIssues: number
  overdueIssues: number
  pendingChanges: number
  pendingMatches: number
  pendingDeliveries: number
  deadLetters: number
  generatedAt: string
}

export interface MdmQualityScanResult {
  opened: number
  refreshed: number
  reopened: number
  pendingVerification: number
  evaluatedAt: string
}

export interface MdmMatchScanResult {
  created: number
  scannedAt: string
}

export interface MdmDataStewardInput {
  domainKey: MdmGovernanceDomain
  sourceType: string | null
  stewardUserId: string
  escalationUserId: string | null
  slaHours: number
  enabled: boolean
}

export interface MdmQualityRuleInput {
  ruleCode: string
  ruleName: string
  domainKey: MdmGovernanceDomain
  sourceType: string
  severity: MdmSeverity
  threshold: number
  slaHours: number
  definition: Record<string, unknown>
  effectiveFrom: string
}

export interface MdmOutboxConsumerInput {
  consumerKey: string
  consumerName: string
  eventTypes: string[]
  contractVersion: number
  visibilityTimeoutSeconds: number
  maxAttempts: number
  enabled: boolean
  replaySince: string | null
}
