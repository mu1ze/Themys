import { evaluateSystemOne, type JevAnswer, type JevQuestion } from "@/lib/jev"
import type { ClauseFlag } from "@/lib/llm"
import {
  choiceCandidateIds,
  JEV_NO_MATCH,
  mapWithConcurrency,
  segmentDocumentIntoClauseSpans,
  type JevClauseSpan,
} from "@/lib/jev-scan-core"

export const CONFIDENCE_THRESHOLD = 0.80
// Each batch sends 45 presence and 45 evidence-selection questions. Bounded
// parallel batches limit context size without serializing the whole document.
export const JEV_CLAUSES_PER_BATCH = 30
export const JEV_MAX_CONCURRENT_BATCHES = 3
const JEV_EVIDENCE_PER_BATCH = 20

export type RiskDefinition = {
  key: string
  category: string
  detectPrompt: string
  quotePrompt: string
  defaultSeverity: "high" | "medium" | "low"
  isStandardPractice: boolean
  explanation: string
  whyItMatters: string
  defaultAction: string
}

export type AurDefinition = {
  key: string
  category: string
  detectPrompt: string
  quotePrompt: string
  actionType: "settings_toggle" | "arbitration_opt_out" | "appeal_channel" | "statutory_right" | "technical_exemption" | "refund_dispute"
  actionLabel: string
  remedyGuidance: string
  matchingRiskKey?: string
}

export const EXPANDED_RISKS: RiskDefinition[] = [
  {
    key: "ai_model_training",
    category: "AI & ML Model Training",
    detectPrompt: "Does this document permit using customer or user content, code, or prompts to train, fine-tune, or improve machine learning or AI models?",
    quotePrompt: "Which clause permits using customer or user content or prompts to train machine learning or AI models?",
    defaultSeverity: "high",
    isStandardPractice: false,
    explanation: "The company claims the right to ingest your content, code, or prompts into artificial intelligence and machine learning models.",
    whyItMatters: "Your proprietary code, documents, or personal data may be used to train models accessible to third parties or future commercial systems.",
    defaultAction: "Request terms that explicitly prohibit using your content to train AI models.",
  },
  {
    key: "mandatory_arbitration",
    category: "Mandatory Binding Arbitration",
    detectPrompt: "Does this document force users to resolve disputes through mandatory binding individual arbitration instead of a court of law?",
    quotePrompt: "Which clause mandates binding individual arbitration for dispute resolution?",
    defaultSeverity: "high",
    isStandardPractice: false,
    explanation: "You waive your constitutional right to have disputes heard before a judge or jury in a public courtroom.",
    whyItMatters: "Private arbitration limits appeal rights, restricts evidence discovery, and typically favors large corporate entities.",
    defaultAction: "Check for a 30-day arbitration opt-out procedure in the agreement and send written notice if you wish to preserve your court rights.",
  },
  {
    key: "class_action_waiver",
    category: "Class Action Lawsuit Waiver",
    detectPrompt: "Does this document require users to waive the right to participate in or bring a class action lawsuit or representative proceeding?",
    quotePrompt: "Which clause specifically waives the right to participate in a class action or class-wide arbitration?",
    defaultSeverity: "high",
    isStandardPractice: false,
    explanation: "You cannot join with other affected customers in a collective or class action lawsuit against the company.",
    whyItMatters: "Small financial claims are economically impossible to litigate individually, giving the provider practical immunity for widespread small-dollar harms.",
    defaultAction: "Consider sending an arbitration opt-out letter if permitted, or document individual claims promptly if disputes arise.",
  },
  {
    key: "unilateral_modification",
    category: "Instant Terms Modification",
    detectPrompt: "Does the company reserve the right to update, modify, or change these terms at any time without notice, with continued use deemed acceptance?",
    quotePrompt: "Which clause states that terms can be updated or modified at any time without notice?",
    defaultSeverity: "high",
    isStandardPractice: false,
    explanation: "Terms can be modified at any time without advance written notice; simply using the site binds you to new terms.",
    whyItMatters: "You could unknowingly agree to severe legal or pricing changes simply by visiting the website or keeping an active session.",
    defaultAction: "Bookmark and periodically review the legal terms page, or set up automated URL change monitoring.",
  },
  {
    key: "unilateral_termination",
    category: "Termination Without Notice or Cause",
    detectPrompt: "Can the company suspend or terminate user access or accounts at any time, without notice, for any reason or in its sole discretion?",
    quotePrompt: "Which clause permits the company to terminate or suspend access without notice for any reason?",
    defaultSeverity: "high",
    isStandardPractice: false,
    explanation: "The company reserves the right to cut off your service, shut down your projects, or ban your account at will without justification.",
    whyItMatters: "You have zero operational predictability and no right to advance notice before service interruption or loss of data access.",
    defaultAction: "Maintain independent external backups of all project data and content to prevent sudden operational lock-out.",
  },
  {
    key: "disclaimer_of_warranties",
    category: "Disclaimer of Warranties ('As Is')",
    detectPrompt: "Does this agreement provide services, documents, or software 'as is' and disclaim all express, implied, or statutory warranties (such as merchantability or fitness)?",
    quotePrompt: "Which clause disclaims all warranties or provides materials 'as is' without warranty?",
    defaultSeverity: "high",
    isStandardPractice: false,
    explanation: "The company disclaims all express and implied warranties, offering the platform strictly 'as is' without guarantees of reliability, accuracy, or merchantability.",
    whyItMatters: "If the service fails, contains critical bugs, or corrupts your data, the provider disclaims all legal responsibility for quality.",
    defaultAction: "Inquire about service level agreements (SLAs) or warranty commitments for paid production subscriptions.",
  },
  {
    key: "limitation_of_liability",
    category: "Consequential Damages & Liability Limitation",
    detectPrompt: "Does the company disclaim liability for special, indirect, or consequential damages, or loss of profits, data, or use?",
    quotePrompt: "Which clause disclaims special, indirect, or consequential damages, or limits liability?",
    defaultSeverity: "high",
    isStandardPractice: false,
    explanation: "The company completely limits its financial liability for special, indirect, consequential damages, downtime, or lost profits.",
    whyItMatters: "Even if an outage or defect costs you significant revenue or business reputation, you cannot recover indirect or consequential damages.",
    defaultAction: "Request a liability cap and service-level commitments from the provider.",
  },
  {
    key: "perpetual_content_license",
    category: "Broad Commercial License to User Submissions",
    detectPrompt: "Does the user grant the company a royalty-free or sublicensable license to use, copy, distribute, perform, reproduce, edit, translate, or publish their submissions or content?",
    quotePrompt: "Which clause grants the company permission or license to use, copy, edit, or sublicense user submissions without compensation?",
    defaultSeverity: "high",
    isStandardPractice: false,
    explanation: "The company secures broad rights to reproduce, distribute, edit, translate, and sublicense your submissions and feedback without compensation.",
    whyItMatters: "Any feedback, suggestions, or submitted materials become sublicensable by the provider across all operations without royalties.",
    defaultAction: "Ensure proprietary trade secrets, unreleased intellectual property, or confidential code are not submitted through public portals.",
  },
  {
    key: "images_media_license",
    category: "Broad Public License to Uploaded Images",
    detectPrompt: "Does the user grant a royalty-free or worldwide license to reproduce, display, perform, or sublicense uploaded images, photographs, or graphical content?",
    quotePrompt: "Which clause grants a license to reproduce, display, or sublicense uploaded images or photographs?",
    defaultSeverity: "medium",
    isStandardPractice: false,
    explanation: "You grant a worldwide, royalty-free license for the provider and community to display, copy, format, and sublicense your uploaded images.",
    whyItMatters: "Publicly uploaded images and media can be repurposed or distributed without author attribution or royalties.",
    defaultAction: "Do not upload sensitive, copyrighted, or commercial imagery without dedicated rights retention.",
  },
  {
    key: "account_security_liability",
    category: "Member Account & Breach Liability",
    detectPrompt: "Is the user held liable for losses incurred from account use, or entirely responsible for all activities that occur under their account?",
    quotePrompt: "Which clause states you are entirely responsible for account activities or liable for losses from account use?",
    defaultSeverity: "medium",
    isStandardPractice: true,
    explanation: "You bear strict legal and financial responsibility for all activities that occur under your account, including unauthorized third-party use.",
    whyItMatters: "If a compromised password leads to damages or API misuse, you may be held liable for losses suffered by the provider or third parties.",
    defaultAction: "Enforce multi-factor authentication (MFA) and rotate credentials immediately upon suspicion of a leak.",
  },
  {
    key: "ai_reverse_engineering_ban",
    category: "AI Reverse Engineering & Model Weight Ban",
    detectPrompt: "Does this document prohibit reverse engineering AI services or attempting to discover underlying model algorithms, components, or weights?",
    quotePrompt: "Which clause prohibits reverse engineering AI services or extracting model weights?",
    defaultSeverity: "medium",
    isStandardPractice: true,
    explanation: "The provider prohibits any attempt to probe, decompile, or extract model architectures, weights, or internal system parameters.",
    whyItMatters: "Security researchers and engineers probing model mechanics may risk immediate account termination or legal claims.",
    defaultAction: "Avoid automated weight probing, model extraction queries, or unapproved architectural benchmarking.",
  },
  {
    key: "ai_scraping_prohibition",
    category: "AI Web Scraping & Data Extraction Ban",
    detectPrompt: "Does this document prohibit web scraping, harvesting, or automated data extraction from AI services or websites?",
    quotePrompt: "Which clause prohibits web scraping, harvesting, or automated data extraction?",
    defaultSeverity: "medium",
    isStandardPractice: true,
    explanation: "Automated scraping, harvesting, and programmatic data extraction methods are expressly prohibited.",
    whyItMatters: "Using automated bots or crawlers to collect training data or output streams breaches the agreement.",
    defaultAction: "Use official authenticated REST or GraphQL APIs rather than scraping the web front-end.",
  },
  {
    key: "ai_third_party_liability",
    category: "User Sole Liability for AI Outputs & Claims",
    detectPrompt: "Does this document make the user solely responsible for responding to third-party legal or copyright infringement claims regarding AI service outputs?",
    quotePrompt: "Which clause makes the user solely responsible for third-party claims regarding AI outputs?",
    defaultSeverity: "high",
    isStandardPractice: false,
    explanation: "The user is made solely responsible for any third-party copyright, defamation, or legal claims arising from AI-generated outputs.",
    whyItMatters: "The provider shifts all copyright infringement and legal exposure from generated materials directly onto the end user.",
    defaultAction: "Perform legal clearance or code scanning before incorporating AI-generated code or assets into commercial products.",
  },
  {
    key: "unsolicited_ideas_forfeiture",
    category: "Unsolicited Ideas Confidentiality Forfeiture",
    detectPrompt: "Does the company state that unsolicited ideas or materials submitted will not be treated as confidential or proprietary?",
    quotePrompt: "Which clause states that unsolicited ideas will not be treated as confidential or proprietary?",
    defaultSeverity: "medium",
    isStandardPractice: true,
    explanation: "Any unsolicited product ideas, features, or suggestions sent to the company become non-confidential without compensation.",
    whyItMatters: "The company may implement submitted features without credit, royalties, or patent recognition.",
    defaultAction: "Do not submit proprietary product pitches, invention disclosures, or feature designs through general feedback channels.",
  },
  {
    key: "broad_indemnification",
    category: "Unilateral Indemnity & Legal Fees",
    detectPrompt: "Must the user defend, indemnify, and hold harmless the company or pay their legal fees for claims or breaches arising from user activity?",
    quotePrompt: "Which clause requires the user to indemnify and hold harmless the company?",
    defaultSeverity: "high",
    isStandardPractice: false,
    explanation: "You are required to pay the company's defense costs and legal fees if someone sues them over your content or activity.",
    whyItMatters: "You bear unlimited financial exposure to cover corporate defense expenses even if the claims against the company are frivolous.",
    defaultAction: "Negotiate mutual indemnity or an indemnity liability cap before deploying high-risk enterprise services.",
  },
  {
    key: "auto_renewal_trap",
    category: "Auto-Renewal & Negative Option Billing",
    detectPrompt: "Does the agreement state that subscriptions renew automatically without advance notice, charging payment methods on file unless cancelled beforehand?",
    quotePrompt: "Which clause states that subscription fees renew automatically and will be charged unless cancelled before the renewal date?",
    defaultSeverity: "medium",
    isStandardPractice: true,
    explanation: "Your subscription automatically renews and charges your payment method on file without requiring a separate confirmation notice.",
    whyItMatters: "Common across SaaS, but can lead to unexpected recurring charges if you miss the cancellation cut-off date.",
    defaultAction: "Set calendar reminders 5 days before each billing cycle to evaluate subscription renewal.",
  },
  {
    key: "data_brokerage_sharing",
    category: "Commercial Data Sharing & Selling",
    detectPrompt: "Does this agreement state that the company sells personal user data, device identifiers, or telemetry to third-party data brokers or advertisers?",
    quotePrompt: "Which clause permits selling or transferring personal user data or telemetry to third-party brokers or advertisers?",
    defaultSeverity: "high",
    isStandardPractice: false,
    explanation: "The company sells or transfers personal user information and telemetry to commercial data brokers or marketing partners.",
    whyItMatters: "Your behavioral data, browsing telemetry, and identity can be packaged and resold across third-party marketing networks.",
    defaultAction: "Request that the provider stop selling or sharing your personal data.",
  },
  {
    key: "gag_clause_review_ban",
    category: "Non-Disparagement / Review Prohibition",
    detectPrompt: "Does this agreement prohibit users from publishing negative reviews, disparaging the service, or publicly sharing performance benchmarks?",
    quotePrompt: "Which clause restricts publishing reviews, benchmarking results, or disparaging the service?",
    defaultSeverity: "high",
    isStandardPractice: false,
    explanation: "The company forbids users from leaving negative reviews or publishing software benchmark results.",
    whyItMatters: "Gag clauses suppress honest feedback and are illegal under the US Consumer Review Fairness Act.",
    defaultAction: "Note that non-disparagement gag clauses against honest consumer reviews are unenforceable under federal law.",
  },
  {
    key: "shortened_limitations",
    category: "Shortened Claims Period",
    detectPrompt: "Does the agreement require any legal claim or cause of action to be filed within one year or less or be permanently barred?",
    quotePrompt: "Which clause requires legal claims to be brought within one year or less or be forever barred?",
    defaultSeverity: "high",
    isStandardPractice: false,
    explanation: "The time you have to file a legal claim is dramatically shortened from statutory law (often 2–4 years) down to 1 year or less.",
    whyItMatters: "If a delayed harm or breach is discovered after this shortened window, your legal right to compensation is automatically extinguished.",
    defaultAction: "Document and raise any dispute or service failure immediately upon discovery to preserve your claims.",
  },
  {
    key: "inconvenient_venue",
    category: "Inconvenient Mandatory Venue",
    detectPrompt: "Does the document mandate that any dispute must be heard exclusively in courts located in a specific distant city, county, or foreign state?",
    quotePrompt: "Which clause designates exclusive venue and jurisdiction in a specific city or court?",
    defaultSeverity: "medium",
    isStandardPractice: true,
    explanation: "Any legal proceeding must take place in the company's designated jurisdiction, regardless of where you live.",
    whyItMatters: "Traveling or retaining local counsel in another state or country significantly raises the cost of pursuing valid claims.",
    defaultAction: "Standard across most providers, but worth noting if evaluating enterprise contracts where home jurisdiction is preferred.",
  },
  {
    key: "unilateral_price_increase",
    category: "Unilateral Price Hikes",
    detectPrompt: "Does the company reserve the right to increase subscription fees or service prices at will, with payment methods charged automatically?",
    quotePrompt: "Which clause permits the company to change or increase subscription fees at its discretion?",
    defaultSeverity: "medium",
    isStandardPractice: true,
    explanation: "The provider reserves the right to increase fees at its discretion.",
    whyItMatters: "Your ongoing subscription costs can increase without requiring your explicit re-authorization before billing.",
    defaultAction: "Monitor billing receipts regularly and exercise your right to cancel before modified rates take effect.",
  },
  {
    key: "third_party_links_disclaimer",
    category: "Third-Party Links Disclaimer",
    detectPrompt: "Does the company disclaim all responsibility for contents, transmissions, or changes of linked external third-party websites?",
    quotePrompt: "Which clause states that the company is not responsible for the contents of linked third-party sites?",
    defaultSeverity: "low",
    isStandardPractice: true,
    explanation: "The company provides external links as a convenience only and disclaims any endorsement or liability for linked third-party sites.",
    whyItMatters: "If a linked external service suffers a compromise or changes malicious content, the provider has zero liability.",
    defaultAction: "Verify URLs and review terms independently when following outbound third-party links.",
  },
  {
    key: "non_commercial_use_limitation",
    category: "Personal & Non-Commercial Use Restriction",
    detectPrompt: "Does the document restrict use of the services strictly to personal and non-commercial purposes, prohibiting commercial copying or distribution?",
    quotePrompt: "Which clause limits the services strictly to personal and non-commercial use?",
    defaultSeverity: "medium",
    isStandardPractice: true,
    explanation: "The services and documentation are restricted strictly to personal and non-commercial use.",
    whyItMatters: "Commercial deployment, enterprise re-distribution, or monetization under consumer terms constitutes a breach of contract.",
    defaultAction: "Ensure business workflows and team deployments are licensed under commercial or enterprise tiers.",
  },
  {
    key: "moral_rights_waiver",
    category: "Moral Rights & Attribution Waiver",
    detectPrompt: "Does the agreement require users to waive moral rights, paternity, or attribution claims in their content or submissions?",
    quotePrompt: "Which clause requires users to waive moral rights or attribution in their content?",
    defaultSeverity: "medium",
    isStandardPractice: true,
    explanation: "You waive your legal moral rights to attribution, author credit, and integrity over submitted content.",
    whyItMatters: "The company may publish, modify, or exploit your creative contributions without crediting you as the author.",
    defaultAction: "Do not publish creative portfolios or works requiring strict attribution under these terms.",
  },
  {
    key: "service_availability_no_sla",
    category: "No Uptime or Availability Guarantee",
    detectPrompt: "Does the provider state that the service may be interrupted, delayed, discontinued, or not error-free, with no guarantee of continuous uptime?",
    quotePrompt: "Which clause states that the service may be interrupted or that uptime and continuous availability are not guaranteed?",
    defaultSeverity: "medium",
    isStandardPractice: true,
    explanation: "The company disclaims any guarantee that the service will be continuous, uninterrupted, secure, or bug-free.",
    whyItMatters: "If unplanned outages or service disruptions occur, the provider owes zero compensation or contractual credit.",
    defaultAction: "Ensure business-critical applications maintain redundancy or obtain an enterprise SLA with financial credits.",
  },
  {
    key: "user_infringement_warranty",
    category: "User Content Non-Infringement Warranty",
    detectPrompt: "Does the user warrant and represent that their content, submissions, or data do not violate or infringe any third-party intellectual property, privacy, or publicity rights?",
    quotePrompt: "Which clause requires the user to warrant that their content does not infringe third-party rights?",
    defaultSeverity: "medium",
    isStandardPractice: true,
    explanation: "You legally guarantee that any text, code, or images you upload do not infringe any patents, copyrights, or third-party rights.",
    whyItMatters: "If a third party asserts copyright or patent claims against your uploaded material, you are in breach of contract and liable for indemnification.",
    defaultAction: "Ensure you own all necessary rights, licenses, and releases for any materials uploaded or processed.",
  },
  {
    key: "investigation_monitoring",
    category: "Account Surveillance & Content Monitoring",
    detectPrompt: "Does the company reserve the right to monitor, review, inspect, or disclose user communications, accounts, or content for compliance or to law enforcement?",
    quotePrompt: "Which clause permits the company to monitor, review, or disclose user content or communications?",
    defaultSeverity: "medium",
    isStandardPractice: true,
    explanation: "The company reserves the right to inspect, monitor, and disclose your communications and uploaded materials without notice.",
    whyItMatters: "Your content and account telemetry may be reviewed by automated filters, human moderators, or disclosed to third parties.",
    defaultAction: "Avoid storing unencrypted sensitive personal or corporate communications on the platform.",
  },
  {
    key: "survival_of_terms",
    category: "Perpetual Survival of Legal Obligations",
    detectPrompt: "Do indemnity obligations, liability limitations, license grants, or dispute clauses explicitly survive termination or cancellation of the agreement?",
    quotePrompt: "Which clause states that obligations, indemnities, or terms survive termination or account cancellation?",
    defaultSeverity: "low",
    isStandardPractice: true,
    explanation: "Even after you cancel or delete your account, key clauses like indemnification and liability caps remain legally binding forever.",
    whyItMatters: "You cannot escape past legal liabilities or licenses simply by closing your account.",
    defaultAction: "Be aware that intellectual property licenses and indemnities survive account deletion.",
  },
]

export const EXPANDED_AURS: AurDefinition[] = [
  {
    key: "ai_training_opt_out",
    category: "AI Model Training Opt-Out Toggle",
    detectPrompt: "Does the document mention a specific in-app toggle or team settings option (e.g., in team settings or privacy controls) to opt out of AI model training?",
    quotePrompt: "Which clause describes the settings toggle or option to opt out of Model Training on user content?",
    actionType: "settings_toggle",
    actionLabel: "Account Settings Toggle",
    remedyGuidance: "Use the model-training opt-out described in the quoted terms; check the current account settings for its location.",
    matchingRiskKey: "ai_model_training",
  },
  {
    key: "telemetry_ad_opt_out",
    category: "Telemetry & Ad Tracking Opt-Out",
    detectPrompt: "Does the agreement provide a specific mechanism, link, or toggle for users to opt out of non-essential telemetry, targeted ads, or personal data sales?",
    quotePrompt: "Which clause mentions an opt-out mechanism for analytics, tracking, or personal data sales?",
    actionType: "settings_toggle",
    actionLabel: "Privacy Control Toggle",
    remedyGuidance: "Use the tracking or data-sharing opt-out described in the quoted terms and follow its stated procedure.",
    matchingRiskKey: "data_brokerage_sharing",
  },
  {
    key: "arbitration_opt_out_window",
    category: "30-Day Arbitration Opt-Out Window",
    detectPrompt: "Does this document give users the right to opt out of the arbitration clause and class action waiver by sending written notice within 30 days?",
    quotePrompt: "Which clause states that users can opt out of arbitration by sending written notice within 30 days of opening an account?",
    actionType: "arbitration_opt_out",
    actionLabel: "30-Day Written Notice",
    remedyGuidance: "Follow the quoted arbitration opt-out clause's notice method and deadline.",
    matchingRiskKey: "mandatory_arbitration",
  },
  {
    key: "dmca_copyright_procedure",
    category: "DMCA Copyright Notice & Agent Procedure",
    detectPrompt: "Does this document provide formal procedures or a designated agent for submitting notifications of claimed copyright infringement under Title 17 (DMCA)?",
    quotePrompt: "Which clause provides the procedure or designated agent for copyright infringement notices under Title 17?",
    actionType: "appeal_channel",
    actionLabel: "DMCA Designated Agent",
    remedyGuidance: "Submit copyright notices or dispute wrongful takedowns through the formal procedure and designated copyright agent specified under 17 U.S.C. 512(c)(2).",
  },
  {
    key: "privacy_statement_link",
    category: "Privacy Disclosures & Cookie Controls",
    detectPrompt: "Does this document link to a dedicated Privacy Statement or disclosures for managing personal data collection?",
    quotePrompt: "Which clause refers users to the Privacy Statement or disclosures for personal data collection?",
    actionType: "settings_toggle",
    actionLabel: "Privacy Statement & Controls",
    remedyGuidance: "Consult the linked Privacy Statement and account settings to configure personal data disclosures, cookie preferences, and tracking choices.",
  },
  {
    key: "account_security_incident_report",
    category: "Unauthorized Account Use Reporting",
    detectPrompt: "Does the document provide an obligation or channel for users to immediately notify the provider upon discovering unauthorized account use or a security breach?",
    quotePrompt: "Which clause instructs users to immediately notify the provider of unauthorized account use or security breach?",
    actionType: "appeal_channel",
    actionLabel: "Security Incident Notice",
    remedyGuidance: "Immediately notify the company's security/support team upon discovering unauthorized account access or credential theft to limit liability.",
    matchingRiskKey: "account_security_liability",
  },
  {
    key: "price_hike_cancellation",
    category: "Price Increase Cancellation Remedy",
    detectPrompt: "Does the agreement provide that if the user does not agree to a price change or modified terms, they have the right to cancel before the effective date without penalty?",
    quotePrompt: "Which clause allows users to reject fee changes or modified terms by cancelling their account before the changes take effect?",
    actionType: "refund_dispute",
    actionLabel: "Notice-Period Cancellation",
    remedyGuidance: "If the company increases subscription rates, cancel your subscription before the effective date to reject the price hike without penalty.",
    matchingRiskKey: "unilateral_price_increase",
  },
  {
    key: "dsa_content_appeal",
    category: "DSA Content & Suspension Appeal Channel",
    detectPrompt: "Does this document provide formal procedures or an internal appeal portal (such as under the EU Digital Services Act) to dispute content removal or account termination?",
    quotePrompt: "Which clause specifies the appeal process or contact point for challenging content removal or account suspension under the DSA or EU law?",
    actionType: "appeal_channel",
    actionLabel: "Internal Appeal Portal",
    remedyGuidance: "Submit an appeal through the internal complaint handling system or EEA appeal channel if your account or content was suspended.",
    matchingRiskKey: "unilateral_termination",
  },
  {
    key: "dmca_counter_notice",
    category: "DMCA Counter-Notice Procedure",
    detectPrompt: "Does this document provide formal instructions, an online form, or designated copyright agent contact information for filing a DMCA counter-notice?",
    quotePrompt: "Which clause provides the procedure and contact information for filing a DMCA counter-notice or copyright dispute?",
    actionType: "appeal_channel",
    actionLabel: "DMCA Counter-Notice",
    remedyGuidance: "If your content was wrongfully removed under a copyright claim, file a formal DMCA counter-notice with the designated copyright agent.",
  },
  {
    key: "informal_dispute_period",
    category: "Mandatory Informal Dispute Negotiation",
    detectPrompt: "Does this agreement require or provide for a mandatory informal dispute resolution period (e.g. 30 or 60 days) where users can negotiate directly before arbitration?",
    quotePrompt: "Which clause requires the parties to attempt informal dispute resolution in writing before initiating arbitration?",
    actionType: "appeal_channel",
    actionLabel: "Informal Settlement Channel",
    remedyGuidance: "Send a written notice of dispute to corporate counsel to initiate the informal resolution window for direct settlement before arbitration.",
    matchingRiskKey: "mandatory_arbitration",
  },
  {
    key: "california_terms_by_mail",
    category: "California Consumer Written Terms Right",
    detectPrompt: "Do California residents have the right to request these terms mailed to them electronically by sending a written letter?",
    quotePrompt: "Which clause allows California residents to have these terms mailed to them by sending a letter?",
    actionType: "statutory_right",
    actionLabel: "California Resident Right",
    remedyGuidance: "California residents can write to the registered office with their email address to demand an electronic copy of terms.",
  },
  {
    key: "crawler_robots_txt_exemption",
    category: "Robots.txt Scraping Safe Harbor",
    detectPrompt: "Does this document explicitly permit automated crawling, scraping, or bot access if declared and allowed in the website's robots.txt file with a dedicated user-agent?",
    quotePrompt: "Which clause permits automated scraping or bot access when explicitly allowed in robots.txt under a dedicated user-agent?",
    actionType: "technical_exemption",
    actionLabel: "Robots.txt Safe Harbor",
    remedyGuidance: "Automated bots and AI agents are permitted if declared under a dedicated user-agent explicitly allowed in the site's robots.txt file.",
  },
  {
    key: "security_research_safe_harbor",
    category: "Security Vulnerability Disclosure Safe Harbor",
    detectPrompt: "Does the agreement provide a safe harbor or vulnerability disclosure policy exempting good-faith security researchers from legal prosecution or account bans?",
    quotePrompt: "Which clause provides a security research safe harbor or coordinated vulnerability disclosure policy?",
    actionType: "technical_exemption",
    actionLabel: "Security Researcher Safe Harbor",
    remedyGuidance: "Good-faith security research is protected under the coordinated vulnerability disclosure policy if reported through authorized channels.",
  },
  {
    key: "gdpr_ccpa_export_delete",
    category: "GDPR / CCPA Data Portability & Erasure",
    detectPrompt: "Does the document provide a procedure, email, or privacy portal for users to request personal data export, access, or permanent deletion under GDPR or CCPA?",
    quotePrompt: "Which clause provides the contact email or procedure to request personal data export or deletion under GDPR or CCPA?",
    actionType: "statutory_right",
    actionLabel: "Data Portability & Erasure",
    remedyGuidance: "Send a Data Subject Access Request (DSAR) to the designated privacy contact to receive a complete export or permanent deletion of your data.",
  },
  {
    key: "statutory_cooling_off",
    category: "14-Day Statutory Withdrawal Window",
    detectPrompt: "Does the agreement state that consumers in the European Union or UK have a 14-day statutory right of withdrawal and refund after purchase?",
    quotePrompt: "Which clause mentions the 14-day withdrawal or cooling-off period for EEA or UK consumers?",
    actionType: "statutory_right",
    actionLabel: "14-Day Statutory Withdrawal",
    remedyGuidance: "Consumers in the EU/UK can cancel their subscription within 14 days of purchase for a full refund under statutory withdrawal rules.",
  },
  {
    key: "abuse_api_token",
    category: "Automated Abuse API Token Access",
    detectPrompt: "Can high-volume reporters or users request access to an automated abuse reporting API token to programmatically submit complaints?",
    quotePrompt: "Which clause mentions requesting an automated abuse API token for programmatic report submission?",
    actionType: "technical_exemption",
    actionLabel: "Abuse Reporting API Token",
    remedyGuidance: "Request an automated abuse API token from the trust and safety team to programmatically manage reports and enforcement.",
  },
  {
    key: "designated_legal_contact",
    category: "Designated Legal & Support Contact",
    detectPrompt: "Does this document provide a direct contact email address (such as support@ or legal@) or physical address for sending correspondence and inquiries?",
    quotePrompt: "Which clause provides the contact email address or postal address for correspondence?",
    actionType: "appeal_channel",
    actionLabel: "Direct Contact Channel",
    remedyGuidance: "Direct formal legal demands and inquiries to the dedicated contact email and postal address specified in the agreement.",
  },
]

/**
 * Splits document text into clean segmented clauses or paragraphs.
 */
export function segmentDocumentIntoClauses(text: string): Record<string, string> {
  return Object.fromEntries(segmentDocumentIntoClauseSpans(text).map((clause) => [clause.id, clause.text]))
}

export type JevScanDiagnostics = {
  modelVersion: string
  durationMs: number
  batches: Array<{
    modelVersion: string
    clauseIds: string[]
    sourceSpans: Array<{ id: string; start: number; end: number }>
    durationMs: number
    inputTokens: number
    outputTokens: number
    answers: Record<string, JevAnswer>
  }>
  evidenceBatches: Array<{
    modelVersion: string
    candidateCount: number
    durationMs: number
    inputTokens: number
    outputTokens: number
  }>
  evidence: Array<{
    kind: "risk" | "right"
    key: string
    clauseId: string
    detectProbability: number
    choiceProbability: number | null
    choiceConfidence: number | null
    evidenceProbability: number
    accepted: boolean
  }>
}

export type JevScanResult = {
  flags: ClauseFlag[]
  actionableRights: ClauseFlag[]
  clauseCount: number
  diagnostics: JevScanDiagnostics
}

/**
 * Executes a full System One scan using Jev.
 * Evaluates the configured risks and actionable rights together.
 * Applies a provisional 80% Noul threshold that must be calibrated on scan data.
 *
 * Strictly separates:
 * - flags: Legal risks ONLY (AI training, arbitration, unilateral change, blanket liability, indemnity)
 * - actionableRights: In-app toggles, opt-out windows, appeal channels, safe harbors, and statutory rights
 */
export async function scanTermsWithJev(
  text: string,
  options: {
    targetClauses?: string[]
    strictMode?: boolean
  } = {},
): Promise<JevScanResult> {
  const startedAt = Date.now()
  const clauses = segmentDocumentIntoClauseSpans(text)
  if (clauses.length === 0) throw new Error("No clauses available for Jev scanning")
  const chunks: JevClauseSpan[][] = []
  for (let offset = 0; offset < clauses.length; offset += JEV_CLAUSES_PER_BATCH) {
    chunks.push(clauses.slice(offset, offset + JEV_CLAUSES_PER_BATCH))
  }

  const batches = await mapWithConcurrency(chunks, JEV_MAX_CONCURRENT_BATCHES, async (batchClauses, index) => {
    const criteria = Object.fromEntries(batchClauses.map(({ id }) => [id, null])) as Record<string, string | null>
    criteria[JEV_NO_MATCH] = "None of these clauses supports the condition in the question."
    const questions: Record<string, JevQuestion> = {}
    for (const risk of EXPANDED_RISKS) {
      questions[`risk_${risk.key}_detect`] = { type: "noul", instructions: risk.detectPrompt }
      questions[`risk_${risk.key}_clause`] = { type: "choice", instructions: risk.quotePrompt, criteria }
    }
    for (const right of EXPANDED_AURS) {
      questions[`aur_${right.key}_detect`] = { type: "noul", instructions: right.detectPrompt }
      questions[`aur_${right.key}_clause`] = { type: "choice", instructions: right.quotePrompt, criteria }
    }

    const batchStartedAt = Date.now()
    const state = JSON.stringify({ clauses: Object.fromEntries(batchClauses.map(({ id, text: clauseText }) => [id, clauseText])) })
    const response = await evaluateSystemOne(state, questions)
    if (!response.answers || Object.entries(questions).some(([id, question]) => {
      const answer = response.answers[id]
      if (!answer || answer.type !== question.type) return true
      if (question.type === "noul" && answer.type === "noul") {
        return !Number.isFinite(answer.noul) || answer.noul < 0 || answer.noul > 1
      }
      if (question.type === "choice" && answer.type === "choice") {
        return !(answer.choice in question.criteria)
      }
      return true
    })) throw new Error(`Jev returned incomplete answers for batch ${index + 1}`)

    return { clauses: batchClauses, response, durationMs: Date.now() - batchStartedAt }
  })

  type Candidate = {
    kind: "risk" | "right"
    key: string
    clause: JevClauseSpan
    detectProbability: number
    choiceProbability: number | null
    choiceConfidence: number | null
    condition: string
  }
  const candidates: Candidate[] = []
  for (const batch of batches) {
    const clauseById = new Map(batch.clauses.map((clause) => [clause.id, clause]))
    const availableIds = new Set(clauseById.keys())
    const addCandidates = (kind: "risk" | "right", key: string, condition: string, prefix: string) => {
      const detect = batch.response.answers[`${prefix}_${key}_detect`]
      const choice = batch.response.answers[`${prefix}_${key}_clause`]
      if (detect?.type !== "noul" || choice?.type !== "choice" || detect.noul < CONFIDENCE_THRESHOLD) return
      for (const id of choiceCandidateIds(choice, availableIds)) {
        const clause = clauseById.get(id)
        if (!clause) continue
        candidates.push({
          kind, key, clause, condition,
          detectProbability: detect.noul,
          choiceProbability: choice.probabilities?.[id] ?? null,
          choiceConfidence: choice.confidence ?? null,
        })
      }
    }
    for (const risk of EXPANDED_RISKS) addCandidates("risk", risk.key, risk.detectPrompt, "risk")
    for (const right of EXPANDED_AURS) addCandidates("right", right.key, right.detectPrompt, "aur")
  }

  const evidenceChunks: Candidate[][] = []
  for (let offset = 0; offset < candidates.length; offset += JEV_EVIDENCE_PER_BATCH) {
    evidenceChunks.push(candidates.slice(offset, offset + JEV_EVIDENCE_PER_BATCH))
  }
  const evidenceResults = await mapWithConcurrency(evidenceChunks, JEV_MAX_CONCURRENT_BATCHES, async (chunk) => {
    const evidenceStartedAt = Date.now()
    const state = JSON.stringify({ candidates: chunk.map((candidate) => ({
      text: candidate.clause.text,
      condition: candidate.condition,
    })) })
    const questions = Object.fromEntries(chunk.map((_, index) => [
      `evidence_${index}`,
      {
        type: "noul",
        instructions: {
          question: `Does \`candidates[${index}].text\` directly support \`candidates[${index}].condition\`?`,
          scope: "Judge only this excerpt. Do not use other clauses or assume missing qualifications.",
        },
        criteria: {
          true: "The excerpt explicitly supports the complete condition.",
          false: "The excerpt is unrelated, incomplete, negates the condition, or requires an unsupported inference.",
        },
      } satisfies JevQuestion,
    ]))
    const response = await evaluateSystemOne(state, questions)
    const checks = chunk.map((candidate, index) => {
      const answer = response.answers?.[`evidence_${index}`]
      if (answer?.type !== "noul" || !Number.isFinite(answer.noul)) {
        throw new Error("Jev returned an incomplete evidence check")
      }
      return { candidate, evidenceProbability: answer.noul }
    })
    return { checks, response, durationMs: Date.now() - evidenceStartedAt }
  })
  const verified = evidenceResults.flatMap((result) => result.checks)

  const accepted = verified.filter(({ evidenceProbability }) => evidenceProbability >= CONFIDENCE_THRESHOLD)
  const rights = accepted.filter(({ candidate }) => candidate.kind === "right")
  const actionableRights: ClauseFlag[] = rights.map(({ candidate, evidenceProbability }) => {
    const right = EXPANDED_AURS.find((item) => item.key === candidate.key)!
    return {
      id: `aur-${right.key}-${candidate.clause.id}`,
      category: right.category,
      severity: "low",
      text: candidate.clause.text,
      explanation: `Remedy detected: ${right.actionLabel}.`,
      whyItMatters: right.remedyGuidance,
      recommendedAction: `${right.actionLabel}: ${right.remedyGuidance}`,
      riskScore: 1,
      confidence: Math.min(candidate.detectProbability, evidenceProbability),
      isStandardPractice: false,
      isTargetClause: false,
      source: "llm",
    }
  })

  const flags: ClauseFlag[] = accepted.filter(({ candidate }) => candidate.kind === "risk").flatMap(({ candidate, evidenceProbability }) => {
    const risk = EXPANDED_RISKS.find((item) => item.key === candidate.key)!
    const isTargetClause = options.targetClauses?.some((target) => risk.category.toLowerCase().includes(target.toLowerCase())) || false
    if (options.strictMode && !isTargetClause) return []
    const remedy = rights.find(({ candidate: rightCandidate }) =>
      EXPANDED_AURS.find((right) => right.key === rightCandidate.key)?.matchingRiskKey === risk.key,
    )
    const remedyDefinition = remedy && EXPANDED_AURS.find((right) => right.key === remedy.candidate.key)
    const severity = risk.isStandardPractice && !isTargetClause ? "medium" : risk.defaultSeverity
    return [{
      id: `flag-${risk.key}-${candidate.clause.id}`,
      category: risk.category,
      severity,
      text: candidate.clause.text,
      explanation: risk.explanation,
      whyItMatters: risk.whyItMatters,
      recommendedAction: remedyDefinition
        ? `${remedyDefinition.actionLabel}: ${remedyDefinition.remedyGuidance}`
        : risk.defaultAction,
      riskScore: severity === "high" ? 8 : severity === "medium" ? 5 : 3,
      confidence: Math.min(candidate.detectProbability, evidenceProbability),
      isStandardPractice: risk.isStandardPractice,
      isTargetClause,
      source: "llm" as const,
    }]
  })

  const modelVersion = batches[0].response.model
  const diagnostics: JevScanDiagnostics = {
    modelVersion,
    durationMs: Date.now() - startedAt,
    batches: batches.map((batch) => ({
      modelVersion: batch.response.model,
      clauseIds: batch.clauses.map((clause) => clause.id),
      sourceSpans: batch.clauses.map(({ id, start, end }) => ({ id, start, end })),
      durationMs: batch.durationMs,
      inputTokens: batch.response.usage?.input_tokens ?? 0,
      outputTokens: batch.response.usage?.output_tokens ?? 0,
      answers: batch.response.answers,
    })),
    evidenceBatches: evidenceResults.map((result) => ({
      modelVersion: result.response.model,
      candidateCount: result.checks.length,
      durationMs: result.durationMs,
      inputTokens: result.response.usage?.input_tokens ?? 0,
      outputTokens: result.response.usage?.output_tokens ?? 0,
    })),
    evidence: verified.map(({ candidate, evidenceProbability }) => ({
      kind: candidate.kind,
      key: candidate.key,
      clauseId: candidate.clause.id,
      detectProbability: candidate.detectProbability,
      choiceProbability: candidate.choiceProbability,
      choiceConfidence: candidate.choiceConfidence,
      evidenceProbability,
      accepted: evidenceProbability >= CONFIDENCE_THRESHOLD,
    })),
  }
  console.info("[jev-scanner] Completed", {
    modelVersion, clauses: clauses.length, batches: batches.length,
    candidates: candidates.length, flags: flags.length, rights: actionableRights.length,
    durationMs: diagnostics.durationMs,
  })
  return { flags, actionableRights, clauseCount: clauses.length, diagnostics }
}
