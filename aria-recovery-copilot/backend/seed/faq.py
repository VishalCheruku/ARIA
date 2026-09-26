"""FAQ-style entries for common logistical questions (spec §10)."""

from seed import chunk

CHUNKS = [
    chunk(
        "How to reach your care team",
        "faq", "faq",
        """Your care team is the group of nurses, doctors, and coordinators responsible for your recovery, and reaching them should never require guesswork. Your discharge summary lists the specific numbers to use; save them in your phone under 'Care team' today, before you need them, and write the main one on paper near your medicines for family members to find.
Use the right channel for the need: routine questions that can wait a day — a confusing label, a diet doubt, a follow-up time — suit messages through your dashboard, an SMS reply to an ARIA reminder, or a call during working hours. Questions about symptoms that are new or worrying but not emergency-level — a wound looking redder, medicines you could not keep down, fever — deserve a same-day call to the team number rather than a message that might sit unread. Emergency symptoms — chest pain, breathlessness, heavy bleeding, stroke signs, fainting, severe allergic reaction, thoughts of self-harm — go to emergency services immediately; never queue those behind a phone menu.
When you call, have ready: your medicine list, your thermometer reading if fever, a photo of any wound change, and a one-sentence summary of what changed today and when. That structure turns a long anxious call into a short useful one. Ask at the end of every conversation: 'what should make me call back?' — the answer becomes your personal red-flag list.
If your team's hours have closed and the matter cannot wait until morning but is not an emergency, use the after-hours or emergency department guidance your hospital gave you; hospitals expect out-of-hours calls about recovering patients and prefer them to morning surprises. And remember the ARIA channels for what they are for: SMS replies and follow-up calls are read by your team; the Ask ARIA chat answers grounded questions and escalates emergencies; nothing here replaces the human number saved under 'Care team' — that remains your most important piece of recovery equipment after your medicines.""",
        ["contact", "care team", "channels"],
    ),
    chunk(
        "What this Copilot can and cannot help with",
        "faq", "faq",
        """The ARIA Recovery Copilot is a question-answering assistant scoped deliberately, and knowing its edges makes it far more useful. It can help with: understanding your recovery — what your medicines are generally for, what your discharge instructions mean in plainer language, what your diet and activity guidance says, how wounds heal, what your monitoring window and reminders will look like; it can explain warning signs for your condition category and tell you which situations need your care team or emergency services; and it grounds every answer in a curated knowledge base plus the minimal context summary from your own record, showing its sources.
It cannot and will not: diagnose what your specific symptom is; give doses, dose changes, or drug-interaction rulings — those belong to your prescriber and pharmacist; prescribe, cancel, or change any medicine; read between the lines of your full hospital record, because it deliberately sees only a small summary; replace your doctor, nurse, pharmacist, or your own judgment; or handle emergencies — by design, the moment a message sounds like an emergency, the Copilot stops advising and pushes you toward real help, because minutes matter and chat is the wrong tool for them.
Two habits make it work best. Ask specific questions — 'when can I shower with my incision?' gets a better answer than 'tell me about surgery'. And say what is on your mind plainly, including worry — if you tell it you are scared, it will acknowledge that before the facts, and if you mention something urgent, it will tell you to get real help immediately.
When the Copilot does not have reliable information — some questions genuinely are not in its knowledge base — it says so honestly and points you to your care team rather than guessing. That refusal is a feature: in recovery, 'I don't know, ask someone who does' is one of the most valuable answers a system can give. Everything else it does, it does with sources attached, so you can always see where an answer came from.""",
        ["scope", "limitations", "grounding"],
    ),
    chunk(
        "What if you miss an ARIA call or SMS",
        "faq", "process",
        """Missed an ARIA reminder SMS or a scheduled follow-up call? Nothing bad happens immediately, and the fix is simple — but do respond deliberately rather than ignoring it.
If you missed an SMS: reply when you notice, with the day's answer even if late. The dashboard records replies whenever they arrive, and a late 'all medicines taken, feeling fine' is far better than silence. Repeated silence at higher risk tiers is itself a signal — the system may schedule a family notice or a call — so if you cannot reply by text for any reason (vision, typing, language, phone access), tell your care team once and they will arrange an alternative responder or channel.
If you missed the voice call: the schedule continues; the missed call is logged. Two or three missed calls usually trigger contact with your listed family member, so if calls keep arriving at impossible times — work hours, medical appointments, prayer times, sleep — tell your care team to shift the call window. The schedule serves your recovery; it is meant to bend to your actual life.
If your phone is lost, discharged, or out of coverage for a stretch, inform the care team or have family do it: a known gap is watched differently from an unexplained one. And if you deliberately prefer not to be contacted by a channel — some people dislike calls, some dislike texts — say so; a channel you answer beats a channel you avoid.
One boundary stays fixed regardless of missed contacts: none of these channels are emergency routes. If emergency symptoms are happening, call emergency services first, whatever the schedule says. For everything else, the answer to a missed contact is always the same two steps: respond late rather than never, and adjust the schedule so tomorrow works. The system is built on the assumption that patients are busy, tired, and human — it would rather you use it imperfectly than perfectly ignore it.""",
        ["missed call", "missed SMS", "schedule"],
    ),
    chunk(
        "Follow-up appointments: why they carry so much weight",
        "faq", "faq",
        """Follow-up appointments are easy to skip when you are feeling better, and they are among the highest-value hours in your whole recovery. Here is why they matter and how to get the most from them.
What happens there: your care team examines what is healing — the wound, the chest, the legs, the sugar logs — reviews your medicines against how you are actually taking them, adjusts doses that need adjusting, and checks the specific things that cannot be checked from home. Many complications announce themselves quietly before they announce themselves loudly; a follow-up is where a recovering wound, a fading heart rhythm, an early infection, or a medicine side effect gets caught while it is still a five-minute fix instead of a readmission.
How to prepare: bring every medicine — the actual boxes, not the list — plus any vitamins or herbal products; bring your glucose meter, blood pressure readings, or daily weight log if your condition uses them; write down your three best questions and your one biggest worry in advance, because appointments run on time and memory blurs; and if a family member helps your care, bring them.
During the visit: say honestly what you have skipped, struggled with, or not understood — clinicians can only adjust what they know; ask for written changes before leaving; and confirm the next appointment date and what should make you call in between.
If you cannot attend: reschedule, never just no-show — teams can often shift appointments, arrange teleconsultation, or combine visits to reduce travel. If transport, cost, or work is the barrier, say so plainly; hospitals have solutions for all three and would rather use them than meet you in the emergency department later.
The pattern across every recovery guide is the same: people who keep their follow-ups get their problems found early. It is the cheapest insurance appointment you will ever keep.""",
        ["follow-up", "appointment", "preparation"],
    ),
    chunk(
        "Driving after discharge: general guidance",
        "guideline", "faq",
        """When you can drive again depends on what you had done, what medicines you take, and local law — so your own care team's clearance always wins over general guidance. The general principles behind every version of that advice are worth knowing.
Anesthesia and sedation: after general anesthesia or strong sedation, judgment and reflexes are genuinely impaired for at least twenty-four to forty-eight hours even if you feel sharp, so no driving in that window at all.
Surgery on movement-relevant sites: after chest, abdominal, or any surgery where a seatbelt, steering, or an emergency stop would strain the repair, driving waits until you can perform an emergency stop without hesitation or pain — a test you can practice as a passenger with the car parked, pressing the brake hard. Shoulder, hand, and some orthopedic procedures limit driving longest, often weeks, because steering demands the exact strength and range you are rebuilding.
Medicines: opioid-type painkillers, some anti-anxiety medicines, and several others carry explicit drowsiness warnings and rule out driving while you take them. Blood-sugar medicines matter too: if you have had a low sugar episode recently, or you cannot reliably feel your lows, do not drive until that is settled with your team. Seizure medicines carry their own legal intervals, usually a fixed number of seizure-free months.
Practical framing for the decision: driving is a full-body, full-attention task — strength, neck turning to check mirrors, reaction speed, and concentration all need to be back at baseline. Ask yourself three questions: could I brake hard right now without wincing? Am I taking anything that warns about drowsiness? Would I pass a careful driving test today, not next month? Any 'no' or 'not sure' means the answer is not yet — confirm the date at your follow-up. Meanwhile, plan rides for follow-ups and errands through family or the transport options many hospitals can arrange; independence returns quickly, and returning to it safely is part of the recovery, not a delay of it.""",
        ["driving", "anesthesia", "medicines", "clearance"],
    ),
    chunk(
        "Returning to work: general guidance on timing",
        "guideline", "faq",
        """How soon you can work after discharge depends on what you do, what you had done, and how your recovery is trending — your care team's certificate and advice override any general timeline. The principles, however, are consistent across recoveries.
Match work to what it demands, not to a calendar date: a desk job that is mostly sitting and thinking returns earliest; a job with lifting, standing all day, driving, night shifts, or heavy concentration returns later; work in healthcare, food handling, or around vulnerable people may need specific clearance — for example, wound closure or being past the contagious window of an infection — before you can safely return.
The phased return is the best-kept secret of successful comebacks: many employers and doctors will arrange shorter days, lighter duties, or fewer shifts for the first week or two. People who phase back stay back; people who leap to full days on the first Monday often crash and lose the following week. If your employer offers it, take it; if not, ask your doctor to recommend it in the fit note.
Energy management at work matters as much as attendance: plan rest breaks before you are exhausted, protect sleep fiercely in the first weeks back, keep meals steady, and continue the daily walking or breathing program your team prescribed even after you return — rehabilitation does not end because the job resumed.
Know the signs you came back too early: exhaustion that sleep does not fix, pain trending up instead of down, wound drainage or redness reappearing, breathlessness on tasks that were fine last week, or mood flattening. Any of those deserve a step back and a call to your care team rather than a push through.
Finally, keep the paperwork practical: get your fitness-for-work note updated at follow-ups, and if your recovery is long, ask about occupational health, workplace adjustments, or disability provisions early — they exist, they are normal, and using them protects the one asset your work depends on: you, recovered properly.""",
        ["return to work", "phased return", "energy"],
    ),
    chunk(
        "Sleeping and resting comfortably after surgery",
        "guideline", "faq",
        """Sleep after surgery is often surprisingly bad for the first weeks — strange bed positions, wound discomfort, medicines, and daytime napping all conspire — and poor sleep slows everything from pain control to mood. These adjustments help most people.
Position: follow your team's specific instructions first, because some operations forbid certain positions for weeks. Otherwise, the winning pattern is usually a slightly raised upper body — two pillows or a recliner — with a pillow under the knees to take strain off the back and abdomen, and a pillow hugged against chest or abdominal incisions when rolling or coughing. Side sleepers can cradle a pillow along the incision line to block pressure.
Pain and sleep feed each other: pain wrecks sleep, short sleep lowers pain tolerance. Time your evening pain dose so it is working through the first hours of sleep, and ask your team before bed rather than waking at two in the morning to decide. Avoid caffeine after mid-afternoon, keep the bedroom cool and dark, and park screens an hour before you want to be asleep.
Routines rebuild sleep faster than effort does: same wake time daily even after a bad night, no long morning lie-ins, daylight exposure early in the day, naps kept short and before mid-afternoon, and a wind-down ritual — wash, stretch gently, read a few pages — that tells your body the day is closing. If breathing exercises were prescribed, doing them lying down at night doubles as relaxation practice.
Call your care team if sleep stays broken beyond a couple of weeks, if pain reliably wakes you every night — that pattern deserves a pain-plan review rather than endurance — or if you notice loud snoring with waking gasps, since sleep apnea both disrupts recovery and often emerges when painkillers are on board. Guarding your sleep is not indulgence during recovery; it is one of the three pillars alongside medicine and movement, and it deserves the same seriousness.""",
        ["sleep", "positioning", "pain at night"],
    ),
    chunk(
        "Your privacy in the ARIA Copilot",
        "faq", "process",
        """Recovery questions are personal, so it is fair to ask what this Copilot knows about you and who can see it. Here is the honest picture, in plain language.
What it sees: when you open the chat, the Copilot receives a small, minimal summary from your record — your first name, risk tier, diagnosis, medicine list, restrictions, and discharge date — and nothing more. It does not receive your full hospital documents, your contact numbers, or your family's details. Your messages and the assistant's answers are stored in the Copilot's own separate database so conversations can continue and your care team can review escalations; that store is kept separate from the main hospital system and access-restricted like clinical data.
What it stores about emergencies: if you describe something that sounds like an emergency, the Copilot alerts your care team through the hospital's existing alert pipeline. The alert carries a short description of the emergency signal — the category, not your raw chat text — so the escalation log stays minimal. A record that the emergency banner was shown is kept in your conversation.
What it never does: it never sells or shares your data for marketing; it never gives the model free rein to invent medical facts — answers are grounded in a reviewed knowledge base, and sources are shown; and it never uses your messages to make diagnoses or dose decisions.
What you control: you can ask your care team what is stored about your conversations, and you can simply stop using the chat at any time — it is a service, not a requirement. If you have privacy questions beyond this summary, your hospital's data-protection contact can answer them in detail.
The design principle underneath all of this: the Copilot should know only what it needs to answer your recovery questions safely, and it should be easy to see what it knows. If anything about the system ever feels wrong, say so at your follow-up — your feedback is part of how the system is reviewed and improved.""",
        ["privacy", "data", "PHI"],
    ),
]
