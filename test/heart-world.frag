<!-- ================= 07 / WITHIN THE HEART — the content world ================= -->
    <section class="flat-heart-world" id="heartWorld">
      <div class="heart-stage" aria-hidden="true">
        <div class="heart-glow"></div>
        <svg class="heart-svg" viewBox="0 0 640 640">
          <defs>
            <linearGradient id="hMass" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stop-color="#d8576c"/>
              <stop offset=".42" stop-color="#a32c41"/>
              <stop offset="1" stop-color="#571019"/>
            </linearGradient>
            <linearGradient id="hAo" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="#c95f6d"/>
              <stop offset="1" stop-color="#84222f"/>
            </linearGradient>
            <radialGradient id="hGlow" cx="50%" cy="48%" r="52%">
              <stop offset="0" stop-color="rgba(255,120,135,.42)"/>
              <stop offset="1" stop-color="rgba(255,120,135,0)"/>
            </radialGradient>
            <radialGradient id="hShade" cx="42%" cy="36%" r="72%">
              <stop offset="0" stop-color="rgba(255,180,180,0)"/>
              <stop offset=".62" stop-color="rgba(90,12,26,0)"/>
              <stop offset="1" stop-color="rgba(52,6,14,.62)"/>
            </radialGradient>
            <filter id="hb10"><feGaussianBlur stdDeviation="10"/></filter>
            <filter id="hb4"><feGaussianBlur stdDeviation="4"/></filter>
          </defs>
          <ellipse cx="320" cy="340" rx="252" ry="240" fill="url(#hGlow)"/>
          <g id="heartBeatG">
            <!-- great vessels -->
            <path d="M318 152 C 326 88 392 58 446 88 C 490 112 494 168 458 198 L 442 182 C 470 156 466 122 432 104 C 392 82 346 102 338 158 Z" fill="url(#hAo)"/>
            <path d="M330 152 C 338 96 394 70 440 92" stroke="rgba(255,190,190,.28)" stroke-width="5" fill="none"/>
            <rect x="366" y="38" width="18" height="46" rx="9" fill="url(#hAo)"/>
            <rect x="398" y="30" width="18" height="52" rx="9" fill="url(#hAo)"/>
            <rect x="430" y="40" width="18" height="44" rx="9" fill="url(#hAo)"/>
            <path d="M262 150 C 236 100 168 92 138 124 C 116 148 122 178 146 194 L 158 178 C 142 166 138 148 154 136 C 176 118 226 126 246 164 Z" fill="#b04256"/>
            <path d="M252 142 C 226 106 176 100 152 126" stroke="rgba(255,190,190,.2)" stroke-width="4" fill="none"/>
            <!-- atria -->
            <circle cx="196" cy="212" r="60" fill="#b8414f"/>
            <circle cx="452" cy="216" r="54" fill="#a03344"/>
            <circle cx="182" cy="200" r="34" fill="rgba(255,170,170,.18)" filter="url(#hb4)"/>
            <!-- main mass -->
            <path d="M322 148 C 262 92 148 116 128 224 C 110 330 178 452 252 540 C 290 586 350 586 388 540 C 462 452 530 330 512 224 C 492 116 382 92 322 148 Z" fill="url(#hMass)"/>
            <path d="M252 540 C 290 586 350 586 388 540 C 420 502 452 456 476 408 C 430 476 340 520 268 500 Z" fill="rgba(60,10,18,.35)"/>
            <path d="M322 148 C 262 92 148 116 128 224 C 110 330 178 452 252 540 C 290 586 350 586 388 540 C 462 452 530 330 512 224 C 492 116 382 92 322 148 Z" fill="url(#hShade)"/>
            <ellipse cx="242" cy="252" rx="86" ry="118" fill="rgba(255,190,190,.2)" filter="url(#hb10)" transform="rotate(-18 242 252)"/>
            <ellipse cx="238" cy="196" rx="26" ry="40" fill="rgba(255,220,215,.28)" filter="url(#hb10)" transform="rotate(-24 238 196)"/>
            <!-- coronaries -->
            <g fill="none" stroke-linecap="round">
              <path d="M330 172 C 320 262 300 362 282 468" stroke="rgba(255,120,100,.4)" stroke-width="10" filter="url(#hb4)"/>
              <path d="M330 172 C 320 262 300 362 282 468" stroke="#ff9d8a" stroke-width="6"/>
              <path d="M322 250 C 296 262 276 284 266 312" stroke="#ff9d8a" stroke-width="4"/>
              <path d="M308 330 C 330 344 344 366 350 392" stroke="#ff9d8a" stroke-width="4"/>
              <path d="M244 190 C 202 252 192 332 222 420" stroke="#f2836f" stroke-width="5"/>
              <path d="M424 208 C 454 278 444 342 402 404" stroke="#f2836f" stroke-width="4"/>
              <path d="M470 250 C 484 292 482 322 468 356" stroke="#d8a0a8" stroke-width="3"/>
            </g>
            <ellipse cx="316" cy="470" rx="30" ry="18" fill="rgba(255,220,180,.12)"/>
            <ellipse cx="212" cy="300" rx="22" ry="34" fill="rgba(255,220,180,.10)"/>
          </g>
        </svg>
        <!-- anatomy labels, shown while the parts panel is on screen -->
        <div class="heart-labels" aria-hidden="true">
          <span class="hl" style="--lx:60%; --ly:4%"><i></i>Aorta</span>
          <span class="hl" style="--lx:26%; --ly:12%"><i></i>Pulmonary artery</span>
          <span class="hl" style="--lx:8%;  --ly:36%"><i></i>Right atrium</span>
          <span class="hl" style="--lx:92%; --ly:38%"><i></i>Left atrium</span>
          <span class="hl" style="--lx:20%; --ly:80%"><i></i>Right ventricle</span>
          <span class="hl" style="--lx:74%; --ly:84%"><i></i>Left ventricle</span>
          <span class="hl" style="--lx:50%; --ly:30%"><i></i>Valves × 4</span>
          <span class="hl" style="--lx:56%; --ly:62%"><i></i>Coronary arteries</span>
        </div>
        <div class="heart-rings"><i></i><i></i><i></i></div>
        <div class="heart-cells">
          <i style="--cd:0s;   --cl:12%; --cs:10px; --ct:9s"></i>
          <i style="--cd:1.2s; --cl:26%; --cs:6px;  --ct:12s"></i>
          <i style="--cd:2.4s; --cl:44%; --cs:8px;  --ct:10s"></i>
          <i style="--cd:.8s;  --cl:58%; --cs:5px;  --ct:13s"></i>
          <i style="--cd:3.1s; --cl:72%; --cs:9px;  --ct:11s"></i>
          <i style="--cd:1.9s; --cl:86%; --cs:7px;  --ct:12s"></i>
          <i style="--cd:2.9s; --cl:35%; --cs:5px;  --ct:14s"></i>
          <i style="--cd:4.1s; --cl:66%; --cs:6px;  --ct:10s"></i>
        </div>
        <svg class="heart-strip" viewBox="0 0 1200 120" preserveAspectRatio="none">
          <path class="heart-strip-line" d="M0 60 H160 q6 -12 12 0 h24 l6 9 9 -52 9 66 9 -23 h36 q8 -16 16 0 h60 q6 -12 12 0 h24 l6 9 9 -52 9 66 9 -23 h36 q8 -16 16 0 h120 q6 -12 12 0 h24 l6 9 9 -52 9 66 9 -23 h36 q8 -16 16 0 h60 q6 -12 12 0 h24 l6 9 9 -52 9 66 9 -23 h36 q8 -16 16 0 h120"/>
        </svg>
      </div>

      <div class="heart-flow">
        <header class="heart-intro">
          <p class="flat-eyebrow">07 / WITHIN THE HEART</p>
          <h3 class="flat-giant">Inside the muscle<br /><em>that never rests.</em></h3>
          <p class="heart-intro-sub">The camera settles between these walls. Two things matter now — <b>knowing the muscle</b>, and <b>protecting the repair</b>.</p>
        </header>

        <article class="heart-panel side-left" data-anatomy>
          <div class="hp-head">
            <span class="hp-idx">H·01</span>
            <i class="hp-ico">♥</i>
            <span class="hp-live"><i></i>ANATOMY</span>
          </div>
          <h4>The heart's main parts</h4>
          <p class="hp-lead">Four chambers, four one-way valves, and its own blood supply — match each label on the beating heart.</p>
          <dl class="hp-facts">
            <div><dt>Right atrium</dt><dd>Collects oxygen-poor blood returning from the body</dd></div>
            <div><dt>Right ventricle</dt><dd>Pumps it out through the pulmonary artery to the lungs</dd></div>
            <div><dt>Left atrium</dt><dd>Receives freshly oxygenated blood back from the lungs</dd></div>
            <div><dt>Left ventricle</dt><dd>The main pump — drives blood to the entire body</dd></div>
            <div><dt>Aorta</dt><dd>The body's largest artery — the exit highway</dd></div>
            <div><dt>Valves × 4</dt><dd>One-way doors: tricuspid, pulmonary, mitral, aortic</dd></div>
            <div><dt>Coronaries</dt><dd>The heart feeds itself first — blockages here cause heart attacks</dd></div>
          </dl>
          <div class="hp-chips"><span>Beats ~100,000× a day</span><span>Moves ≈ 7,500 L daily</span><span>Own electrical grid — SA node</span></div>
        </article>

        <article class="heart-panel side-right hp-alert">
          <div class="hp-head">
            <span class="hp-idx">H·02</span>
            <i class="hp-ico">◍</i>
            <span class="hp-live red"><i></i>PRECAUTIONS</span>
          </div>
          <h4>Care precautions</h4>
          <p class="hp-lead">Protect the repair while it heals — the rules are simple, and they matter.</p>
          <div class="hp-dodont">
            <div class="do"><b>DO</b><ul><li>Keep the incision clean &amp; dry</li><li>Walk a little further each day</li><li>Sleep 7–8 hours, on schedule</li><li>Log blood pressure every morning</li><li>Take medicines at the same time daily</li></ul></div>
            <div class="dont"><b>AVOID</b><ul><li>Lifting anything over 5 kg for 6 weeks</li><li>Smoking and vaping — completely</li><li>Driving until cleared (2–4 weeks)</li><li>Double doses — never catch up by doubling</li><li>Crowded places for the first month</li></ul></div>
          </div>
          <div class="hp-emg">
            <b>CALL EMERGENCY SERVICES NOW IF</b>
            <ul><li>Chest pain or pressure over 5 minutes · severe breathlessness at rest · fainting · racing, irregular pulse with dizziness</li></ul>
          </div>
          <div class="hp-emg same-day">
            <b>CALL THE CLINIC SAME DAY IF</b>
            <ul><li>New ankle swelling · weight up 2 kg in 48 hours · new palpitations at rest</li></ul>
          </div>
          <a class="hp-call" href="tel:911">Call emergency services <span>→</span></a>
          <p class="hp-note">Or your local emergency number — save it as a favourite today. ARIA keeps watching between every visit.</p>
        </article>
      </div>
    </section>

