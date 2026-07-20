-- Email Templates module (design email-templates.jsx / web/pages.md §14).
-- Adds the channel column and seeds the canonical template set that every
-- composer (Engage, wizard, campaigns, payment links) references by name.

alter table public.email_templates
  add column if not exists channel text not null default 'Email'
    check (channel in ('Email','WhatsApp'));

-- The pre-0011 seeds are superseded by the design set below; keep the rows
-- (history) but retire them from active pickers.
update public.email_templates
  set status = 'Inactive'
  where template_name in
    ('Send Application Package','Payment Request','Policy Issued','Renewal Reminder');

insert into public.email_templates (template_name, channel, status, subject, body)
select v.template_name, v.channel, 'Active', v.subject, v.body
from (values
  ('New inquiry response','Email','Thank you for your interest in Pacific Insurance PH', E'Hi {{first_name}},\n\nThank you for reaching out about {{product}}. I''d be glad to walk you through your options and answer any questions.\n\nWhen would be a good time for a short call this week?\n\nBest regards,\n{{agent}}\nPacific Insurance PH'),
  ('Send brochure','Email','{{product}} — plan details & brochure', E'Hi {{first_name}},\n\nAs promised, please find attached the brochure for {{product}}. It covers the benefits, coverage limits, and premium options.\n\nLet me know if you''d like me to prepare a personalized proposal.\n\nBest regards,\n{{agent}}'),
  ('Send application form','Email','Your {{product}} application form', E'Hi {{first_name}},\n\nAttached is the application form for {{product}}. Please complete the highlighted sections and return it with a valid ID.\n\nYou can also fill out our secure intake form here: [intake link]\n\nHappy to help if you have any questions.\n\n{{agent}}'),
  ('Request missing documents','Email','A few documents to complete your application', E'Hi {{first_name}},\n\nTo move your {{product}} application forward, we still need the following:\n\n- (documents will be listed here)\n\nYou can reply with clear photos or scans. Thank you!\n\n{{agent}}'),
  ('Payment instruction','Email','Payment instructions for your {{product}} policy', E'Hi {{first_name}},\n\nYour proposal for {{product}} is ready. The premium is {{premium}}.\n\nHere are your payment options and instructions:\n\n- (payment details)\n\nOnce paid, kindly send the proof of payment and we''ll process your policy right away.\n\n{{agent}}'),
  ('Proof of payment follow-up','Email','Following up on your {{product}} payment', E'Hi {{first_name}},\n\nJust following up on the payment for your {{product}} plan ({{premium}}). If you''ve already paid, please share the proof of payment so we can finalize your coverage.\n\nThank you!\n{{agent}}'),
  ('Policy issued','Email','Your {{product}} policy is now active', E'Hi {{first_name}},\n\nGreat news — your {{product}} policy has been issued and is now active. Your policy documents and e-card are attached.\n\nPlease keep these for your records. Reach out anytime if you need assistance.\n\n{{agent}}'),
  ('Renewal reminder','Email','Time to renew your {{product}} policy', E'Hi {{first_name}},\n\nYour {{product}} policy is up for renewal. The renewal premium is {{premium}}.\n\nTo keep your coverage continuous, please settle before the expiry date. I can send a payment link right away — just let me know.\n\n{{agent}}'),
  ('Claim requirement request','Email','Documents needed for your claim', E'Hi {{first_name}},\n\nWe''ve received your claim under your {{product}} policy. To proceed, please submit the following requirements:\n\n- (claim documents)\n\nOnce complete, we''ll forward everything to the provider.\n\n{{agent}}'),
  ('Travel insurance payment instruction','Email','Payment link for your travel insurance', E'Hi {{first_name}},\n\nYour travel insurance quote is ready ({{premium}}). Please use the secure payment link below to confirm coverage before departure:\n\n- (payment link)\n\nSafe travels!\n{{agent}}'),
  ('Birthday greeting','Email','Happy birthday, {{first_name}}! 🎉', E'Hi {{first_name}},\n\nHappy birthday from all of us at Pacific Insurance PH! We''re grateful to have you in the family and hope your day is wonderful.\n\nAs always, we''re here whenever you need us — your {{product}} coverage keeps you and your loved ones protected all year round.\n\nWarmest wishes,\n{{agent}}\nPacific Insurance PH'),
  ('Anniversary greeting','Email','Celebrating another year together, {{first_name}}', E'Hi {{first_name}},\n\nToday marks another year of your partnership with Pacific Insurance PH — thank you for your continued trust. It''s a privilege to help protect what matters most to you.\n\nIf there''s ever anything we can do for you, or coverage you''d like to review, I''m just one message away.\n\nHere''s to many more years together,\n{{agent}}'),
  ('Loyalty / thank-you','Email','A thank-you for your loyalty, {{first_name}}', E'Hi {{first_name}},\n\nWe just wanted to say thank you for being a valued client of Pacific Insurance PH. Your loyalty means the world to us.\n\nAs a token of appreciation, we''d love to review your {{product}} coverage and make sure you''re getting the most from your plan — and share any loyalty perks you may qualify for.\n\nWith gratitude,\n{{agent}}'),
  ('Commission Voucher Request','Email','Commission voucher request — {{product}}', E'Hi {{first_name}},\n\nMay I request the commission voucher for {{product}}? The client''s payment has been confirmed and the Official Receipt is on file. Commission due is {{premium}}.\n\nPlease let me know if you need any further details to process it.\n\nThank you,\n{{agent}}\nPacific Insurance PH'),
  ('Commission Follow-Up','Email','Follow-up — commission voucher for {{product}}', E'Hi {{first_name}},\n\nJust following up on the commission voucher for {{product}} (commission {{premium}}). Could you share an update on where it stands?\n\nAppreciate your help — thank you!\n{{agent}}'),
  ('Proposal / Quote Request','Email','Proposal request — {{product}} for {{first_name}}', E'Hi Pacific Cross team,\n\nRequesting a proposal / quote for the following lead:\n\n- Client: {{first_name}}\n- Product: {{product}}\n- Target budget / est. premium: {{budget}}\n- Family size / dependents: {{family_size}}\n- Preferred coverage tier / room: {{coverage_tier}}\n\nKindly send the indicative quote and plan options at your earliest convenience.\n\nThank you,\n{{agent}}\nPacific Insurance PH'),
  ('Proposal / Quote Delivery','Email','Your {{product}} proposal is ready, {{first_name}}', E'Hi {{first_name}},\n\nGood news — your proposal for {{product}} is ready. Based on what we discussed (budget {{budget}}, {{family_size}} to cover, {{coverage_tier}}), here are the recommended plan and premium options:\n\n- (proposal details attached)\n\nI''d be happy to walk you through it on a quick call. Let me know your thoughts!\n\nBest regards,\n{{agent}}\nPacific Insurance PH')
) as v(template_name, channel, subject, body)
where not exists (
  select 1 from public.email_templates e where e.template_name = v.template_name
);
