-- Generated from the canonical regulations registry.
INSERT INTO regulations (id, code, full_name, jurisdiction, category, articles, effective_date, url) VALUES

-- 1. GDPR -------------------------------------------------------
('reg_gdpr', 'GDPR', 'General Data Protection Regulation', 'EU', 'privacy',
  '[
    {"article_id": "Art. 6", "title": "Lawfulness of processing", "summary": "Processing is lawful only if at least one of six legal bases applies, including consent, contract, legal obligation, vital interests, public task, or legitimate interests.", "keywords": ["lawful basis", "consent", "legitimate interest", "legal obligation"]},
    {"article_id": "Art. 7", "title": "Conditions for consent", "summary": "Consent must be freely given, specific, informed, and unambiguous. Controllers must demonstrate consent was given and make withdrawal as easy as giving it.", "keywords": ["consent", "withdraw", "freely given", "demonstrate"]},
    {"article_id": "Art. 13", "title": "Information to be provided (direct collection)", "summary": "When personal data is collected from the data subject, the controller must provide information including purposes, legal basis, retention period, and rights.", "keywords": ["transparency", "privacy notice", "data subject rights", "information"]},
    {"article_id": "Art. 14", "title": "Information to be provided (indirect collection)", "summary": "When data is not obtained from the data subject, the controller must still provide information about the processing, source, and purposes.", "keywords": ["third party data", "transparency", "indirect collection"]},
    {"article_id": "Art. 17", "title": "Right to erasure", "summary": "Data subjects have the right to obtain erasure of personal data when data is no longer necessary, consent is withdrawn, or processing is unlawful.", "keywords": ["right to erasure", "right to be forgotten", "deletion"]},
    {"article_id": "Art. 20", "title": "Right to data portability", "summary": "Data subjects have the right to receive their personal data in a structured, commonly used, machine-readable format and transmit it to another controller.", "keywords": ["data portability", "machine readable", "transfer"]},
    {"article_id": "Art. 22", "title": "Automated individual decision-making", "summary": "Data subjects have the right not to be subject to decisions based solely on automated processing, including profiling, which produce legal or similarly significant effects.", "keywords": ["automated decisions", "profiling", "algorithmic", "human review"]},
    {"article_id": "Art. 44", "title": "General principle for transfers", "summary": "Any transfer of personal data to a third country may only take place if the conditions of Chapter V are complied with.", "keywords": ["international transfer", "third country", "adequacy"]},
    {"article_id": "Art. 45", "title": "Adequacy decisions", "summary": "A transfer to a third country may take place if the Commission has decided that the third country ensures an adequate level of protection.", "keywords": ["adequacy", "adequate protection", "commission decision"]},
    {"article_id": "Art. 46", "title": "Appropriate safeguards", "summary": "In the absence of an adequacy decision, a controller may transfer data using appropriate safeguards such as standard contractual clauses or binding corporate rules.", "keywords": ["SCCs", "standard contractual clauses", "BCRs", "binding corporate rules"]},
    {"article_id": "Art. 49", "title": "Derogations for specific situations", "summary": "In the absence of adequacy or appropriate safeguards, transfers may occur under specific derogations including explicit consent, contract necessity, or public interest.", "keywords": ["derogation", "explicit consent", "transfer exception"]}
  ]',
  '2018-05-25', 'https://eur-lex.europa.eu/eli/reg/2016/679/oj'),

-- 2. CCPA -------------------------------------------------------
('reg_ccpa', 'CCPA', 'California Consumer Privacy Act', 'US-CA', 'privacy',
  '[
    {"article_id": "1798.100", "title": "Right to know — categories", "summary": "Consumers have the right to request disclosure of categories of personal information collected, sources, business purposes, and third parties shared with.", "keywords": ["right to know", "disclosure", "categories", "personal information"]},
    {"article_id": "1798.105", "title": "Right to delete", "summary": "Consumers have the right to request deletion of personal information collected by a business, subject to certain exceptions.", "keywords": ["right to delete", "deletion", "erasure"]},
    {"article_id": "1798.120", "title": "Right to opt-out of sale", "summary": "Consumers have the right to direct a business not to sell their personal information to third parties.", "keywords": ["opt out", "do not sell", "sale of data"]},
    {"article_id": "1798.125", "title": "Non-discrimination", "summary": "A business shall not discriminate against a consumer for exercising CCPA rights, including by denying goods, charging different prices, or providing different quality.", "keywords": ["non-discrimination", "equal service", "no retaliation"]}
  ]',
  '2020-01-01', 'https://leginfo.legislature.ca.gov/faces/codes_displayText.xhtml?division=3.&part=4.&lawCode=CIV&title=1.81.5'),

-- 3. CPRA -------------------------------------------------------
('reg_cpra', 'CPRA', 'California Privacy Rights Act', 'US-CA', 'privacy',
  '[
    {"article_id": "1798.106", "title": "Right to correct", "summary": "Consumers have the right to request correction of inaccurate personal information maintained by a business.", "keywords": ["right to correct", "correction", "rectification", "accuracy"]},
    {"article_id": "1798.121", "title": "Right to limit use of sensitive personal information", "summary": "Consumers can limit the use and disclosure of their sensitive personal information to that which is necessary to perform the services.", "keywords": ["sensitive data", "limit use", "opt out", "sensitive PI"]},
    {"article_id": "1798.185", "title": "Regulations — CPPA enforcement", "summary": "Establishes the California Privacy Protection Agency with full administrative power to implement and enforce the CCPA and CPRA.", "keywords": ["CPPA", "enforcement", "agency", "rulemaking"]}
  ]',
  '2023-01-01', 'https://leginfo.legislature.ca.gov/faces/billNavClient.xhtml?bill_id=201920200Prop24'),

-- 4. COPPA ------------------------------------------------------
('reg_coppa', 'COPPA', 'Children''s Online Privacy Protection Act', 'US', 'privacy',
  '[
    {"article_id": "Rule 312.4", "title": "Notice requirements", "summary": "Operators must post a clear and prominent link to an online privacy policy on their website, describing information collected from children and how it is used.", "keywords": ["children", "privacy notice", "parental notice", "under 13"]},
    {"article_id": "Rule 312.5", "title": "Parental consent", "summary": "Operators must obtain verifiable parental consent before collecting, using, or disclosing personal information from children under 13.", "keywords": ["parental consent", "verifiable consent", "children", "under 13"]},
    {"article_id": "Rule 312.6", "title": "Right to refuse / deletion", "summary": "Parents can refuse further use of information and request deletion of personal information collected from their children.", "keywords": ["parental rights", "deletion", "children", "refuse collection"]}
  ]',
  '2000-04-21', 'https://www.ftc.gov/legal-library/browse/rules/childrens-online-privacy-protection-rule-coppa'),

-- 5. CAN-SPAM ---------------------------------------------------
('reg_can_spam', 'CAN_SPAM', 'CAN-SPAM Act', 'US-FED', 'consumer',
  '[
    {"article_id": "5(a)(1)", "title": "Prohibition of deceptive headers", "summary": "A sender shall not initiate commercial email with materially misleading header information, including from, to, reply-to, and routing information.", "keywords": ["spam", "email", "deceptive headers", "misleading"]},
    {"article_id": "5(a)(2)", "title": "Prohibition of deceptive subject lines", "summary": "A sender shall not initiate commercial email with a subject line that is likely to mislead a recipient about the contents or subject matter.", "keywords": ["spam", "email", "deceptive subject", "misleading"]},
    {"article_id": "6(a)(3)", "title": "Opt-out mechanism", "summary": "A sender must provide a clear and conspicuous opt-out mechanism in commercial email, and honor opt-out requests within 10 business days.", "keywords": ["opt out", "unsubscribe", "email", "commercial message"]}
  ]',
  '2004-01-01', 'https://www.ftc.gov/legal-library/browse/rules/can-spam-act'),

-- 6. FTC Act -----------------------------------------------------
('reg_ftc_act', 'FTC_ACT', 'Federal Trade Commission Act — Section 5', 'US-FED', 'consumer',
  '[
    {"article_id": "5", "title": "Unfair or deceptive acts or practices", "summary": "Unfair or deceptive acts or practices in or affecting commerce are declared unlawful. The FTC has broad authority to investigate and take enforcement action.", "keywords": ["deceptive practices", "unfair practices", "UDAP", "FTC enforcement"]}
  ]',
  '1914-09-26', 'https://www.ftc.gov/legal-library/browse/statutes/federal-trade-commission-act'),

-- 7. ECPA --------------------------------------------------------
('reg_ecpa', 'ECPA', 'Electronic Communications Privacy Act', 'US', 'privacy',
  '[
    {"article_id": "Title I", "title": "Wiretap Act", "summary": "Prohibits interception of electronic communications, wire communications, and oral communications without consent or a valid court order.", "keywords": ["wiretap", "interception", "electronic communications", "consent"]},
    {"article_id": "Title II", "title": "Stored Communications Act", "summary": "Protects the privacy of stored electronic communications. Providers cannot voluntarily disclose contents, with limited exceptions.", "keywords": ["stored communications", "disclosure", "electronic storage", "provider"]}
  ]',
  '1986-10-21', 'https://www.congress.gov/bill/99th-congress/senate-bill/2575'),

-- 8. PIPEDA ------------------------------------------------------
('reg_pipeda', 'PIPEDA', 'Personal Information Protection and Electronic Documents Act', 'CA', 'privacy',
  '[
    {"article_id": "Principle 4.3", "title": "Consent", "summary": "The knowledge and consent of the individual are required for the collection, use, or disclosure of personal information, except where inappropriate.", "keywords": ["consent", "knowledge", "collection", "Canada"]},
    {"article_id": "Principle 4.9", "title": "Individual access", "summary": "Upon request, an individual shall be informed of the existence, use, and disclosure of their personal information and be given access to that information.", "keywords": ["access", "individual rights", "disclosure", "transparency"]},
    {"article_id": "Principle 4.10", "title": "Challenging compliance", "summary": "An individual may challenge the accuracy and completeness of personal information and have it amended, with the challenge recorded.", "keywords": ["challenge", "accuracy", "amendment", "complaint"]}
  ]',
  '2001-01-01', 'https://laws-lois.justice.gc.ca/eng/acts/P-8.6/'),

-- 9. UK DPA ------------------------------------------------------
('reg_uk_dpa', 'UK_DPA', 'UK Data Protection Act 2018', 'GB', 'privacy',
  '[
    {"article_id": "Part 2", "title": "General processing — UK GDPR supplement", "summary": "Supplements the UK GDPR with UK-specific provisions including exemptions, conditions for processing special categories, and children''s consent.", "keywords": ["UK GDPR", "special categories", "children", "exemptions"]},
    {"article_id": "Part 3", "title": "Law enforcement processing", "summary": "Governs processing of personal data by competent authorities for law enforcement purposes, with safeguards and individual rights.", "keywords": ["law enforcement", "police", "criminal data", "competent authority"]}
  ]',
  '2018-05-23', 'https://www.legislation.gov.uk/ukpga/2018/12/contents/enacted'),

-- 10. Australian Privacy Act ------------------------------------
('reg_au_privacy', 'AU_PRIVACY', 'Privacy Act 1988 (Australian Privacy Principles)', 'AU', 'privacy',
  '[
    {"article_id": "APP 1", "title": "Open and transparent management", "summary": "Entities must manage personal information openly and transparently, including having a clearly expressed and up-to-date privacy policy.", "keywords": ["privacy policy", "transparency", "open management", "APPs"]},
    {"article_id": "APP 6", "title": "Use or disclosure", "summary": "An entity may only use or disclose personal information for the primary purpose of collection or a related secondary purpose the individual would reasonably expect.", "keywords": ["purpose limitation", "use", "disclosure", "secondary purpose"]},
    {"article_id": "APP 11", "title": "Security of personal information", "summary": "An entity must take reasonable steps to protect personal information from misuse, interference, loss, and unauthorized access, modification, or disclosure.", "keywords": ["security", "data protection", "reasonable steps", "breach"]}
  ]',
  '1988-12-02', 'https://www.legislation.gov.au/Details/C2021C00278'),

-- 11. EU DSA -----------------------------------------------------
('reg_dsa', 'DSA', 'Digital Services Act', 'EU', 'ecommerce',
  '[
    {"article_id": "Art. 16", "title": "Notice and action mechanisms", "summary": "Online platforms must provide mechanisms for individuals or entities to notify them of illegal content, and act on such notices in a timely and non-arbitrary manner.", "keywords": ["illegal content", "notice", "takedown", "content moderation"]},
    {"article_id": "Art. 17", "title": "Statement of reasons", "summary": "Platforms must provide a clear statement of reasons to affected users for content moderation decisions, including the legal basis and redress options.", "keywords": ["content moderation", "transparency", "statement of reasons", "redress"]},
    {"article_id": "Art. 20", "title": "Internal complaint-handling system", "summary": "Online platforms must provide an internal complaint-handling system that is accessible, free of charge, and allows decisions to be reconsidered.", "keywords": ["complaint", "appeal", "redress", "internal mechanism"]}
  ]',
  '2024-02-17', 'https://eur-lex.europa.eu/eli/reg/2022/2065/oj'),

-- 12. EU DMA -----------------------------------------------------
('reg_dma', 'DMA', 'Digital Markets Act', 'EU', 'competition',
  '[
    {"article_id": "Art. 5", "title": "Obligations for gatekeepers — consent and interoperability", "summary": "Gatekeepers must not combine personal data from different core platform services without consent, and must allow interoperability of ancillary services.", "keywords": ["gatekeeper", "consent", "data combination", "interoperability"]},
    {"article_id": "Art. 6", "title": "Obligations for gatekeepers — fairness and access", "summary": "Gatekeepers shall not use data generated by business users to compete with them, must allow app sideloading, and provide fair access to app stores.", "keywords": ["fairness", "self-preferencing", "app store", "business users"]}
  ]',
  '2023-05-02', 'https://eur-lex.europa.eu/eli/reg/2022/1925/oj'),

-- 13. EU E-Commerce Directive ------------------------------------
('reg_eu_ecommerce', 'EU_ECOMMERCE', 'EU E-Commerce Directive 2000/31/EC', 'EU', 'ecommerce',
  '[
    {"article_id": "Art. 6", "title": "Information requirements", "summary": "Service providers must make available information including their name, geographic address, email, trade register details, and professional body details where applicable.", "keywords": ["information requirements", "transparency", "service provider", "contact details"]},
    {"article_id": "Art. 10", "title": "Information requirements for commercial communications", "summary": "Commercial communications must be clearly identifiable as such, clearly identify the person on whose behalf they are made, and clearly identify promotional offers and their conditions.", "keywords": ["commercial communication", "advertising", "spam", "identification"]}
  ]',
  '2000-06-08', 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=celex:32000L0031'),

-- 14. LGPD -------------------------------------------------------
('reg_lgpd', 'LGPD', 'Lei Geral de Proteção de Dados', 'BR', 'privacy',
  '[
    {"article_id": "Art. 7", "title": "Processing bases", "summary": "Personal data may be processed with consent, for compliance with legal obligations, execution of contracts, for research, for life protection, or for legitimate interests.", "keywords": ["consent", "legal basis", "lawful processing", "Brazil"]},
    {"article_id": "Art. 8", "title": "Conditions for consent", "summary": "Consent must be provided in writing or by other means that demonstrate the free, informed, and unambiguous expression of the data holder''s will.", "keywords": ["consent", "written consent", "data holder", "informed"]},
    {"article_id": "Art. 18", "title": "Data holder rights", "summary": "Data holders have rights including confirmation of processing, access, correction, anonymization, portability, deletion, and information about sharing.", "keywords": ["data holder rights", "access", "portability", "deletion", "correction"]}
  ]',
  '2020-09-18', 'https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm')

ON CONFLICT (code) DO NOTHING;
