<!-- the operating room -->
        <div class="or-room" aria-hidden="true">
          <svg class="or-svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
            <defs>
              <linearGradient id="orWallG" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="#13243a"/>
                <stop offset=".55" stop-color="#0c1728"/>
                <stop offset="1" stop-color="#08101b"/>
              </linearGradient>
              <linearGradient id="orFloorG" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="#101c2a"/>
                <stop offset="1" stop-color="#04070c"/>
              </linearGradient>
              <linearGradient id="orConeG" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="rgba(255,243,214,.34)"/>
                <stop offset="1" stop-color="rgba(255,243,214,0)"/>
              </linearGradient>
              <linearGradient id="orDrapeG" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="#2a7a72"/>
                <stop offset=".45" stop-color="#1a5a55"/>
                <stop offset="1" stop-color="#0d3a3c"/>
              </linearGradient>
              <linearGradient id="orSteelG" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="#33465c"/>
                <stop offset=".5" stop-color="#233346"/>
                <stop offset="1" stop-color="#141f2c"/>
              </linearGradient>
              <linearGradient id="scrubG" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stop-color="#3f7d8e"/>
                <stop offset=".6" stop-color="#2e6272"/>
                <stop offset="1" stop-color="#1f4a57"/>
              </linearGradient>
              <linearGradient id="scrubG2" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stop-color="#356c7c"/>
                <stop offset="1" stop-color="#1b404c"/>
              </linearGradient>
              <linearGradient id="capG" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="#5488bd"/>
                <stop offset="1" stop-color="#2e5a8d"/>
              </linearGradient>
              <linearGradient id="winGlassG" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stop-color="#31495f"/>
                <stop offset=".5" stop-color="#22374c"/>
                <stop offset="1" stop-color="#182a3c"/>
              </linearGradient>
              <linearGradient id="monScrG" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="#03141f"/>
                <stop offset="1" stop-color="#02101a"/>
              </linearGradient>
              <radialGradient id="soulCore" cx="50%" cy="42%" r="55%">
                <stop offset="0" stop-color="rgba(255,255,255,.95)"/>
                <stop offset=".35" stop-color="rgba(207,234,255,.5)"/>
                <stop offset="1" stop-color="rgba(140,200,255,0)"/>
              </radialGradient>
              <radialGradient id="chestGlowG" cx="50%" cy="50%" r="50%">
                <stop offset="0" stop-color="rgba(185,235,255,.8)"/>
                <stop offset="1" stop-color="rgba(185,235,255,0)"/>
              </radialGradient>
              <radialGradient id="skinG" cx="38%" cy="32%" r="85%">
                <stop offset="0" stop-color="#efc5a2"/>
                <stop offset=".6" stop-color="#cf9169"/>
                <stop offset="1" stop-color="#9a6440"/>
              </radialGradient>
              <radialGradient id="floorPoolG" cx="50%" cy="50%" r="50%">
                <stop offset="0" stop-color="rgba(255,238,190,.15)"/>
                <stop offset="1" stop-color="rgba(255,238,190,0)"/>
              </radialGradient>
              <radialGradient id="wallFallG" cx="52%" cy="30%" r="55%">
                <stop offset="0" stop-color="rgba(140,190,240,.12)"/>
                <stop offset="1" stop-color="rgba(140,190,240,0)"/>
              </radialGradient>
              <filter id="ob2"><feGaussianBlur stdDeviation="2"/></filter>
              <filter id="ob4"><feGaussianBlur stdDeviation="4"/></filter>
              <filter id="ob8"><feGaussianBlur stdDeviation="8"/></filter>
              <filter id="ob16"><feGaussianBlur stdDeviation="16"/></filter>
              <filter id="orGrainF" x="0" y="0" width="100%" height="100%">
                <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/>
                <feColorMatrix type="matrix" values="0 0 0 0 0.72  0 0 0 0 0.8  0 0 0 0 0.9  0 0 0 0.05 0"/>
              </filter>
            </defs>

            <!-- shell -->
            <rect width="1600" height="900" fill="url(#orWallG)"/>
            <ellipse cx="830" cy="280" rx="560" ry="420" fill="url(#wallFallG)"/>
            <rect width="1600" height="58" fill="#0b141f"/>
            <g stroke="rgba(160,200,240,.05)" stroke-width="1.5">
              <line x1="160" y1="0" x2="160" y2="58"/><line x1="480" y1="0" x2="480" y2="58"/>
              <line x1="800" y1="0" x2="800" y2="58"/><line x1="1120" y1="0" x2="1120" y2="58"/>
              <line x1="1440" y1="0" x2="1440" y2="58"/>
            </g>
            <rect x="0" y="56" width="1600" height="4" fill="rgba(170,210,250,.10)"/>
            <g stroke="rgba(160,200,240,.045)" stroke-width="2">
              <line x1="200" y1="60" x2="200" y2="776"/><line x1="430" y1="60" x2="430" y2="776"/>
              <line x1="660" y1="60" x2="660" y2="776"/><line x1="890" y1="60" x2="890" y2="776"/>
              <line x1="1120" y1="60" x2="1120" y2="776"/><line x1="1350" y1="60" x2="1350" y2="776"/>
            </g>
            <rect x="0" y="622" width="1600" height="12" fill="#0d1826"/>
            <rect x="0" y="776" width="1600" height="124" fill="url(#orFloorG)"/>
            <rect x="0" y="776" width="1600" height="5" fill="#111d2b"/>

            <!-- window with blinds + light shaft -->
            <g>
              <rect x="64" y="118" width="272" height="220" rx="6" fill="#152638" stroke="#233a52" stroke-width="2"/>
              <g fill="url(#winGlassG)">
                <rect x="74" y="128" width="252" height="19"/><rect x="74" y="154" width="252" height="19"/>
                <rect x="74" y="180" width="252" height="19"/><rect x="74" y="206" width="252" height="19"/>
                <rect x="74" y="232" width="252" height="19"/><rect x="74" y="258" width="252" height="19"/>
                <rect x="74" y="284" width="252" height="19"/>
              </g>
              <rect x="74" y="128" width="252" height="175" fill="rgba(159,200,232,.16)"/>
              <rect x="74" y="128" width="252" height="60" fill="rgba(220,240,255,.10)"/>
              <polygon points="70,338 336,338 640,778 200,778" fill="rgba(150,200,240,.055)" filter="url(#ob8)"/>
            </g>

            <!-- x-ray film viewer -->
            <g>
              <rect x="398" y="146" width="158" height="120" rx="5" fill="#0d1a29" stroke="#223750" stroke-width="1.5"/>
              <rect x="406" y="154" width="142" height="104" fill="#1d3c56"/>
              <ellipse cx="443" cy="208" rx="23" ry="33" fill="rgba(208,232,252,.34)"/>
              <ellipse cx="511" cy="208" rx="23" ry="33" fill="rgba(208,232,252,.34)"/>
              <line x1="477" y1="166" x2="477" y2="250" stroke="rgba(210,235,255,.25)" stroke-width="5"/>
              <path d="M430 190 q10 -8 20 0 M486 190 q10 -8 20 0" stroke="rgba(210,235,255,.14)" stroke-width="3" fill="none"/>
              <rect x="570" y="146" width="132" height="120" rx="5" fill="#0d1a29" stroke="#223750" stroke-width="1.5"/>
              <rect x="578" y="154" width="116" height="104" fill="#16304a"/>
              <rect x="398" y="266" width="304" height="9" rx="3" fill="#132335"/>
              <rect x="398" y="275" width="304" height="4" fill="rgba(150,200,240,.06)"/>
            </g>

            <!-- wall clock -->
            <g>
              <circle cx="744" cy="130" r="23" fill="#e6edf3"/>
              <circle cx="744" cy="130" r="23" fill="none" stroke="#93a6b8" stroke-width="3"/>
              <line x1="744" y1="130" x2="744" y2="115" stroke="#2a3540" stroke-width="3" stroke-linecap="round"/>
              <line x1="744" y1="130" x2="755" y2="136" stroke="#2a3540" stroke-width="2" stroke-linecap="round"/>
              <circle cx="744" cy="130" r="2.4" fill="#c23b3b"/>
            </g>

            <!-- medical gas boom -->
            <g>
              <rect x="1080" y="58" width="14" height="86" rx="6" fill="#23344a"/>
              <circle cx="1087" cy="150" r="9" fill="#2c3f58"/>
              <path d="M1087 152 Q 1092 192 1136 198 L 1258 212" stroke="#243750" stroke-width="9" fill="none" stroke-linecap="round"/>
              <path d="M1258 212 q34 58 96 76" stroke="#2c405a" stroke-width="3.5" fill="none"/>
              <path d="M1252 226 q40 48 88 60" stroke="#223349" stroke-width="3" fill="none"/>
              <circle cx="1348" cy="288" r="7" fill="#33475f"/>
            </g>

            <!-- anesthesia machine, far right -->
            <g>
              <ellipse cx="1540" cy="784" rx="86" ry="10" fill="rgba(0,0,0,.45)" filter="url(#ob8)"/>
              <rect x="1462" y="420" width="138" height="348" rx="10" fill="url(#orSteelG)"/>
              <rect x="1466" y="424" width="130" height="6" fill="rgba(255,255,255,.07)"/>
              <rect x="1474" y="436" width="114" height="66" rx="6" fill="#06141f"/>
              <path d="M1480 476 q8 -12 16 0 t16 0 t16 0 t16 0 t16 0 t16 0" stroke="rgba(90,220,190,.7)" stroke-width="2" fill="none"/>
              <circle cx="1562" cy="480" r="11" fill="#1c2c3e" stroke="#3a5271" stroke-width="3"/>
              <rect x="1474" y="516" width="52" height="42" rx="6" fill="#1a2a3c"/>
              <rect x="1482" y="524" width="36" height="26" rx="4" fill="rgba(120,200,235,.16)"/>
              <rect x="1536" y="516" width="52" height="42" rx="6" fill="#1a2a3c"/>
              <rect x="1544" y="524" width="36" height="26" rx="4" fill="rgba(120,200,235,.10)"/>
              <line x1="1474" y1="584" x2="1588" y2="584" stroke="rgba(255,255,255,.07)" stroke-width="2"/>
              <rect x="1474" y="600" width="114" height="72" rx="9" fill="#213349"/>
              <rect x="1486" y="614" width="90" height="10" rx="5" fill="rgba(160,210,240,.12)"/>
              <rect x="1486" y="636" width="60" height="10" rx="5" fill="rgba(160,210,240,.08)"/>
              <rect x="1474" y="690" width="114" height="30" rx="7" fill="#1a2939"/>
              <circle cx="1482" cy="772" r="11" fill="#0a1119"/><circle cx="1580" cy="772" r="11" fill="#0a1119"/>
              <circle cx="1482" cy="772" r="4" fill="#1e2c3c"/><circle cx="1580" cy="772" r="4" fill="#1e2c3c"/>
            </g>

            <!-- patient monitor cart -->
            <g id="monCart">
              <ellipse cx="1358" cy="784" rx="84" ry="10" fill="rgba(0,0,0,.5)" filter="url(#ob8)"/>
              <rect x="1288" y="430" width="26" height="330" fill="#1b2a3b"/>
              <rect x="1272" y="470" width="168" height="290" rx="10" fill="url(#orSteelG)"/>
              <rect x="1284" y="566" width="144" height="44" rx="6" fill="#1a2a3c"/>
              <rect x="1284" y="622" width="144" height="44" rx="6" fill="#1a2a3c"/>
              <rect x="1312" y="584" width="58" height="8" rx="4" fill="#33485f"/>
              <rect x="1312" y="640" width="58" height="8" rx="4" fill="#33485f"/>
              <rect x="1346" y="706" width="22" height="50" fill="#17242f"/>
              <circle cx="1302" cy="774" r="10" fill="#0a1119"/><circle cx="1414" cy="774" r="10" fill="#0a1119"/>
              <circle cx="1302" cy="774" r="3.5" fill="#1e2c3c"/><circle cx="1414" cy="774" r="3.5" fill="#1e2c3c"/>
              <!-- monitor head -->
              <rect x="1246" y="212" width="232" height="224" rx="16" fill="#0a121c" stroke="#24384e" stroke-width="2"/>
              <rect x="1249" y="215" width="226" height="6" rx="3" fill="rgba(255,255,255,.05)"/>
              <rect x="1260" y="226" width="204" height="196" rx="8" fill="url(#monScrG)"/>
              <g stroke="rgba(90,220,190,.06)" stroke-width="1">
                <line x1="1260" y1="274" x2="1464" y2="274"/><line x1="1260" y1="322" x2="1464" y2="322"/>
                <line x1="1260" y1="370" x2="1464" y2="370"/><line x1="1308" y1="226" x2="1308" y2="422"/>
                <line x1="1356" y1="226" x2="1356" y2="422"/><line x1="1404" y1="226" x2="1404" y2="422"/>
              </g>
              <text x="1270" y="252" font-family="IBM Plex Mono, monospace" font-size="13" fill="#7f97ab">HR</text>
              <text id="monHr" x="1302" y="254" font-family="IBM Plex Mono, monospace" font-size="26" font-weight="700" fill="#ff6b6b">0</text>
              <text x="1366" y="252" font-family="IBM Plex Mono, monospace" font-size="13" fill="#7f97ab">SpO₂</text>
              <text id="monSp" x="1402" y="254" font-family="IBM Plex Mono, monospace" font-size="26" font-weight="700" fill="#59d8ff">68</text>
              <line x1="1266" y1="264" x2="1458" y2="264" stroke="rgba(140,190,220,.14)" stroke-width="1.5"/>
              <path class="ecg-flat" d="M1270 300 H1330 L1338 295 L1346 300 H1410 L1416 297 L1422 300 H1454" fill="none" stroke="#ff5f7a" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
              <path class="ecg-beat" d="M1270 300 h13 q3 -6 7 0 h9 l3 5 5 -26 5 36 5 -15 h12 q5 -9 10 0 h13 q3 -6 7 0 h9 l3 5 5 -26 5 36 5 -15 h12 q5 -9 10 0 h11" fill="none" stroke="#5df2c9" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
              <path class="ecg-pleth" d="M1270 356 h10 q4 -16 10 0 q4 12 10 0 h10 q4 -16 10 0 q4 12 10 0 h10 q4 -16 10 0 q4 12 10 0 h10 q4 -16 10 0 q4 12 10 0 h10 q4 -16 10 0 q4 12 10 0 h10 q4 -16 10 0 q4 12 10 0 h8" fill="none" stroke="rgba(255,110,130,.55)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path class="ecg-resp" d="M1270 404 q10 -18 20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0" fill="none" stroke="rgba(255,214,110,.5)" stroke-width="2" stroke-linecap="round"/>
              <polygon points="1300,226 1348,226 1300,422 1268,422" fill="rgba(255,255,255,.035)"/>
              <rect x="1342" y="436" width="40" height="34" rx="4" fill="#17242f"/>
            </g>

            <!-- defibrillator cart -->
            <g>
              <ellipse cx="188" cy="782" rx="76" ry="9" fill="rgba(0,0,0,.42)" filter="url(#ob8)"/>
              <rect x="110" y="592" width="156" height="176" rx="10" fill="url(#orSteelG)"/>
              <rect x="110" y="592" width="156" height="8" rx="4" fill="rgba(255,255,255,.06)"/>
              <rect x="122" y="608" width="132" height="56" rx="6" fill="#071522"/>
              <rect x="126" y="614" width="64" height="9" rx="3" fill="rgba(237,74,74,.7)"/>
              <rect x="126" y="630" width="42" height="9" rx="3" fill="rgba(90,220,190,.35)"/>
              <path d="M136 654 h104" stroke="rgba(120,220,190,.25)" stroke-width="2"/>
              <rect x="134" y="680" width="108" height="14" rx="7" fill="#1a2a3c"/>
              <rect x="148" y="708" width="80" height="12" rx="6" fill="rgba(237,74,74,.5)"/>
              <rect x="122" y="732" width="132" height="20" rx="6" fill="#16222e"/>
              <circle cx="136" cy="776" r="10" fill="#0a1119"/><circle cx="242" cy="776" r="10" fill="#0a1119"/>
              <circle cx="136" cy="776" r="3.5" fill="#1e2c3c"/><circle cx="242" cy="776" r="3.5" fill="#1e2c3c"/>
            </g>

            <!-- mayo stand -->
            <g>
              <line x1="338" y1="772" x2="338" y2="556" stroke="#26394c" stroke-width="7"/>
              <line x1="300" y1="772" x2="376" y2="772" stroke="#26394c" stroke-width="7" stroke-linecap="round"/>
              <rect x="266" y="542" width="144" height="17" rx="6" fill="url(#orSteelG)"/>
              <rect x="266" y="542" width="144" height="4" rx="2" fill="rgba(255,255,255,.09)"/>
              <rect x="280" y="533" width="28" height="9" rx="4" fill="#9db4c2"/>
              <rect x="284" y="530" width="6" height="5" fill="#9db4c2"/>
              <rect x="318" y="535" width="36" height="7" rx="3" fill="#869dab"/>
              <rect x="362" y="534" width="24" height="8" rx="4" fill="#9db4c2"/>
              <ellipse cx="338" cy="777" rx="52" ry="6" fill="rgba(0,0,0,.4)" filter="url(#ob4)"/>
            </g>

            <!-- anesthesiologist, seated -->
            <g opacity=".92">
              <ellipse cx="1386" cy="784" rx="54" ry="9" fill="rgba(0,0,0,.45)" filter="url(#ob8)"/>
              <rect x="1358" y="636" width="56" height="13" rx="6" fill="#1a2a3c"/>
              <line x1="1366" y1="649" x2="1356" y2="772" stroke="#20313f" stroke-width="9"/>
              <line x1="1408" y1="649" x2="1418" y2="772" stroke="#20313f" stroke-width="9"/>
              <path d="M1350 636 C 1346 592 1356 562 1378 552 L 1410 556 C 1422 578 1426 610 1422 640 Z" fill="url(#scrubG2)"/>
              <path d="M1416 566 C 1420 590 1422 616 1420 640 L 1408 640 C 1412 616 1412 590 1408 570 Z" fill="rgba(0,0,0,.22)"/>
              <rect x="1376" y="530" width="13" height="18" rx="5" fill="#b07c56"/>
              <circle cx="1382" cy="516" r="16.5" fill="url(#skinG)"/>
              <path d="M1365 512 a16.5 16.5 0 0 1 33 0 z" fill="url(#capG)" transform="rotate(-12 1382 512)"/>
              <path d="M1370 522 q14 11 28 2 l0 8 q-14 8 -28 -1 z" fill="#e9eef2"/>
              <path d="M1398 522 l-8 6" stroke="#dfe6ea" stroke-width="2"/>
              <path d="M1404 566 Q 1442 556 1462 538" stroke="#356c7c" stroke-width="12" fill="none" stroke-linecap="round"/>
              <circle cx="1462" cy="536" r="7" fill="#9fc2cf"/>
            </g>

            <!-- IV pole -->
            <g>
              <ellipse cx="1170" cy="780" rx="30" ry="6" fill="rgba(0,0,0,.4)" filter="url(#ob4)"/>
              <line x1="1170" y1="772" x2="1170" y2="292" stroke="#2c3f54" stroke-width="6" stroke-linecap="round"/>
              <line x1="1148" y1="772" x2="1192" y2="772" stroke="#2c3f54" stroke-width="7" stroke-linecap="round"/>
              <path d="M1170 292 l-20 15 M1170 292 l20 15" stroke="#2c3f54" stroke-width="5" stroke-linecap="round"/>
              <rect x="1138" y="308" width="46" height="70" rx="13" fill="rgba(190,225,245,.20)" stroke="rgba(220,240,255,.35)" stroke-width="2"/>
              <rect x="1148" y="315" width="26" height="36" rx="5" fill="rgba(220,240,255,.15)"/>
              <rect x="1138" y="308" width="46" height="8" rx="4" fill="rgba(220,240,255,.25)"/>
              <path d="M1160 378 C 1160 470 1132 520 1122 592" stroke="rgba(210,235,250,.38)" stroke-width="2.5" fill="none"/>
              <rect x="1116" y="588" width="12" height="28" rx="5" fill="rgba(210,235,250,.32)"/>
              <rect x="1118" y="592" width="8" height="8" fill="rgba(190,225,245,.5)"/>
            </g>

            <!-- scrub nurse behind the table -->
            <g opacity=".9">
              <ellipse cx="1118" cy="780" rx="50" ry="9" fill="rgba(0,0,0,.45)" filter="url(#ob8)"/>
              <path d="M1092 776 L1096 656 L1140 656 L1144 776 Z" fill="#1d4753"/>
              <path d="M1088 664 C 1086 616 1096 588 1114 580 L 1140 584 C 1154 602 1158 632 1154 664 Z" fill="url(#scrubG2)"/>
              <rect x="1108" y="560" width="12" height="16" rx="5" fill="#b07c56"/>
              <circle cx="1114" cy="546" r="16" fill="url(#skinG)"/>
              <path d="M1098 542 a16 16 0 0 1 32 0 z" fill="url(#capG)" transform="rotate(-8 1114 542)"/>
              <path d="M1102 552 q13 10 26 2 l0 8 q-13 7 -26 -1 z" fill="#e9eef2"/>
              <path d="M1128 552 l-7 5" stroke="#dfe6ea" stroke-width="2"/>
            </g>

            <!-- operating table + patient -->
            <g id="tablePatient">
              <ellipse cx="830" cy="790" rx="280" ry="17" fill="rgba(0,0,0,.55)" filter="url(#ob16)"/>
              <ellipse cx="830" cy="788" rx="180" ry="10" fill="rgba(0,0,0,.5)" filter="url(#ob8)"/>
              <path d="M794 608 L866 608 L892 770 L768 770 Z" fill="url(#orSteelG)"/>
              <path d="M800 608 L812 608 L792 770 L776 770 Z" fill="rgba(255,255,255,.05)"/>
              <rect x="806" y="608" width="48" height="48" fill="#1d2d3e"/>
              <rect x="736" y="766" width="228" height="18" rx="9" fill="#16222e"/>
              <rect x="748" y="770" width="204" height="6" rx="3" fill="rgba(255,255,255,.04)"/>
              <rect x="596" y="590" width="468" height="20" rx="8" fill="#24384a"/>
              <rect x="596" y="590" width="468" height="5" rx="2" fill="rgba(255,255,255,.07)"/>
              <rect x="608" y="554" width="444" height="40" rx="17" fill="#33505e"/>
              <rect x="608" y="554" width="444" height="8" rx="4" fill="rgba(255,255,255,.06)"/>
              <rect x="982" y="592" width="182" height="18" rx="9" fill="#2a3f50"/>
              <rect x="1032" y="592" width="10" height="18" fill="rgba(210,235,250,.25)"/>
              <!-- patient under the drape -->
              <path d="M640 590 C 640 566 652 552 676 546 L 780 536 C 800 520 832 512 864 521 C 902 528 940 536 962 540 L 986 546 C 992 564 990 578 986 590 Z" fill="url(#orDrapeG)"/>
              <path d="M700 560 q64 12 138 6 M748 578 q54 7 118 2 M662 556 q40 -10 92 -14" stroke="rgba(0,0,0,.24)" stroke-width="3" fill="none"/>
              <path d="M676 546 C 730 538 800 522 862 521" stroke="rgba(255,255,255,.14)" stroke-width="3" fill="none"/>
              <path d="M640 590 h346" stroke="rgba(0,0,0,.3)" stroke-width="4"/>
              <rect x="972" y="546" width="28" height="26" rx="9" fill="#b07c56"/>
              <ellipse cx="1014" cy="540" rx="21" ry="19" fill="rgba(20,10,8,.35)" filter="url(#ob4)"/>
              <circle cx="1014" cy="538" r="20" fill="url(#skinG)"/>
              <path d="M1000 546 a15 15 0 0 0 12 9" stroke="rgba(120,70,40,.35)" stroke-width="3" fill="none"/>
              <circle cx="1006" cy="540" r="3.6" fill="#a06c48"/>
              <path d="M1024 532 q4 2 7 0" stroke="#4a2e1c" stroke-width="2" fill="none" stroke-linecap="round"/>
              <path d="M1023 539 q3 1.6 6 0" stroke="#5f3a26" stroke-width="1.6" fill="none" stroke-linecap="round"/>
              <path d="M1024 546 q3 1.4 5.6 0" stroke="#8a563a" stroke-width="1.6" fill="none" stroke-linecap="round"/>
              <path d="M994 534 a20 20 0 0 1 40 0 z" fill="url(#capG)" transform="rotate(-13 1014 534)"/>
              <path d="M998 528 a18 15 0 0 1 24 -6" stroke="rgba(255,255,255,.18)" stroke-width="2.5" fill="none"/>
              <path d="M1030 546 q4 -4 8 -2" stroke="rgba(220,240,255,.5)" stroke-width="2" fill="none"/>
              <path d="M1034 548 C 1082 538 1112 480 1128 424" stroke="rgba(210,235,250,.38)" stroke-width="2.5" fill="none"/>
              <path d="M998 556 q16 8 32 -2" stroke="rgba(0,0,0,.2)" stroke-width="3" fill="none"/>
            </g>

            <!-- surgical light -->
            <g id="orLight">
              <rect x="806" y="58" width="48" height="10" rx="4" fill="#23344a"/>
              <rect x="824" y="58" width="12" height="26" fill="#23344a"/>
              <path d="M830 84 L776 118" stroke="#233648" stroke-width="9" stroke-linecap="round"/>
              <circle cx="776" cy="118" r="6" fill="#2c405a"/>
              <path d="M776 118 L816 148" stroke="#2c405a" stroke-width="7" stroke-linecap="round"/>
              <circle cx="816" cy="148" r="5" fill="#33475f"/>
              <path d="M742 160 C 742 150 918 150 918 160 L 906 186 C 906 193 754 193 754 186 Z" fill="url(#orSteelG)"/>
              <path d="M742 160 C 742 150 918 150 918 160" stroke="rgba(255,255,255,.14)" stroke-width="2.5" fill="none"/>
              <ellipse cx="830" cy="184" rx="84" ry="17" fill="#1c2a38"/>
              <ellipse cx="830" cy="182" rx="76" ry="15" fill="#efe9d8"/>
              <ellipse cx="830" cy="182" rx="58" ry="11" fill="#fff5d6"/>
              <circle cx="830" cy="182" r="9" fill="#93a5b5"/>
              <circle cx="786" cy="184" r="4" fill="#7c8e9e"/><circle cx="874" cy="184" r="4" fill="#7c8e9e"/>
              <ellipse cx="830" cy="190" rx="96" ry="22" fill="rgba(255,238,180,.5)" filter="url(#ob16)"/>
              <circle cx="830" cy="200" r="30" fill="rgba(255,244,210,.55)" filter="url(#ob16)"/>
              <polygon points="760,192 900,192 1008,562 652,562" fill="rgba(255,240,200,.09)" filter="url(#ob8)"/>
              <polygon points="780,192 880,192 972,560 688,560" fill="url(#orConeG)" filter="url(#ob2)"/>
              <g fill="rgba(255,245,215,.55)">
                <circle cx="800" cy="300" r="1.8" opacity=".5"/><circle cx="852" cy="352" r="1.4" opacity=".4"/>
                <circle cx="818" cy="430" r="2" opacity=".45"/><circle cx="842" cy="486" r="1.5" opacity=".35"/>
                <circle cx="788" cy="520" r="1.4" opacity=".3"/><circle cx="864" cy="262" r="1.3" opacity=".4"/>
              </g>
            </g>

            <!-- chest glow, merge ripples, body flash -->
            <ellipse id="chestGlowEl" cx="830" cy="550" rx="130" ry="74" fill="url(#chestGlowG)" opacity="0"/>
            <ellipse id="flashBody" cx="815" cy="562" rx="190" ry="62" fill="rgba(195,238,255,.8)" filter="url(#ob16)" opacity="0"/>
            <circle id="ripple1" cx="830" cy="550" r="46" fill="none" stroke="rgba(195,238,255,.85)" stroke-width="3" opacity="0"/>
            <circle id="ripple2" cx="830" cy="550" r="46" fill="none" stroke="rgba(255,214,170,.65)" stroke-width="2" opacity="0"/>

            <!-- soul tether: body → drifting soul (path updated by JS) -->
            <path id="threadLight" d="M830 548 Q 850 400 830 250" fill="none" stroke="rgba(205,238,255,.9)" stroke-width="2.5" stroke-linecap="round" opacity="0" filter="url(#ob2)"/>

            <!-- the soul -->
            <g id="soulG" transform="translate(830 190)">
              <g class="soul-bob">
                <ellipse rx="105" ry="115" fill="url(#soulCore)" filter="url(#ob16)"/>
                <path d="M0 -62 C -17 -62 -26 -46 -25 -26 C -31 6 -27 36 0 54 C 27 36 31 6 25 -26 C 26 -46 17 -62 0 -62 Z" fill="rgba(226,242,255,.72)" filter="url(#ob4)"/>
                <circle cy="-66" r="13.5" fill="rgba(244,251,255,.95)" filter="url(#ob2)"/>
                <ellipse cy="2" rx="11" ry="24" fill="rgba(255,255,255,.9)" filter="url(#ob4)"/>
                <path d="M0 54 C -7 68 -5 82 0 94 C 5 82 7 68 0 54 Z" fill="rgba(210,235,255,.4)" filter="url(#ob4)"/>
                <path d="M-25 -10 C -34 4 -33 20 -26 30 M25 -10 C 34 4 33 20 26 30" stroke="rgba(220,240,255,.35)" stroke-width="3" fill="none" stroke-linecap="round" filter="url(#ob2)"/>
                <circle class="sp" style="--sd:0s"   cx="-36" cy="-8"  r="3"   fill="rgba(220,245,255,.85)"/>
                <circle class="sp" style="--sd:.7s"  cx="40"  cy="6"   r="2.4" fill="rgba(220,245,255,.8)"/>
                <circle class="sp" style="--sd:1.3s" cx="-20" cy="34"  r="2"   fill="rgba(220,245,255,.75)"/>
                <circle class="sp" style="--sd:1.9s" cx="26"  cy="-34" r="2.6" fill="rgba(220,245,255,.8)"/>
                <circle class="sp" style="--sd:2.5s" cx="8"   cy="48"  r="1.8" fill="rgba(220,245,255,.7)"/>
                <circle class="sp" style="--sd:3.1s" cx="-42" cy="22"  r="2.2" fill="rgba(220,245,255,.75)"/>
                <circle class="sp" style="--sd:3.7s" cx="18"  cy="64"  r="2"   fill="rgba(220,245,255,.65)"/>
              </g>
            </g>

            <!-- lead doctor -->
            <g id="doctor">
              <ellipse cx="570" cy="782" rx="64" ry="11" fill="rgba(0,0,0,.45)" filter="url(#ob8)"/>
              <ellipse cx="570" cy="782" rx="40" ry="6" fill="rgba(0,0,0,.5)" filter="url(#ob4)"/>
              <path d="M558 500 C 546 520 540 548 546 574" stroke="#1f4652" stroke-width="13" fill="none" stroke-linecap="round"/>
              <circle cx="547" cy="576" r="7" fill="#7fa6b5"/>
              <path d="M554 620 L546 760" stroke="#2b5666" stroke-width="20" fill="none" stroke-linecap="round"/>
              <path d="M560 622 L553 756" stroke="#1c3d49" stroke-width="7" fill="none" stroke-linecap="round"/>
              <path d="M586 620 L592 760" stroke="#234957" stroke-width="20" fill="none" stroke-linecap="round"/>
              <path d="M592 622 L597 756" stroke="#162f3a" stroke-width="7" fill="none" stroke-linecap="round"/>
              <path d="M536 766 q10 -8 22 -6 l2 8 -24 2 z" fill="#10181f"/>
              <path d="M580 764 q12 -6 24 0 l0 6 -26 0 z" fill="#0d141b"/>
              <path d="M536 766 q10 -8 22 -6" stroke="rgba(255,255,255,.10)" stroke-width="1.6" fill="none"/>
              <rect x="548" y="598" width="62" height="28" rx="11" fill="#22485a"/>
              <path d="M546 620 C 542 566 550 528 564 508 L 602 502 C 618 524 626 566 624 620 C 600 632 566 632 546 620 Z" fill="url(#scrubG)"/>
              <path d="M606 506 C 618 530 626 572 624 618 L 610 620 C 614 576 612 538 602 510 Z" fill="rgba(0,0,0,.24)"/>
              <path d="M574 508 L586 524 L598 506" stroke="#16323c" stroke-width="3" fill="none"/>
              <path d="M556 540 q-4 34 -2 70 M612 540 q6 36 4 72" stroke="rgba(0,0,0,.16)" stroke-width="3" fill="none"/>
              <rect x="598" y="542" width="11" height="15" rx="2.5" fill="#cfe0ea" opacity=".8"/>
              <rect x="578" y="478" width="16" height="20" rx="6" fill="#b07c56"/>
              <path d="M578 484 q-3 8 0 14" stroke="rgba(90,50,30,.4)" stroke-width="2.4" fill="none"/>
              <g id="docHeadG">
                <circle cx="585" cy="455" r="17.5" fill="url(#skinG)"/>
                <path d="M572 462 a15 13 0 0 0 12 8" stroke="rgba(130,80,50,.4)" stroke-width="3" fill="none"/>
                <circle cx="577" cy="458" r="3.4" fill="#a06c48"/>
                <path d="M593 449 q4 1.6 7 0" stroke="#4a2e1c" stroke-width="1.8" fill="none" stroke-linecap="round"/>
                <path d="M592 442 q5 -1.4 8 1" stroke="#3a2314" stroke-width="2" fill="none" stroke-linecap="round"/>
                <path d="M601 458 q2 2 -1 4" stroke="rgba(140,90,60,.5)" stroke-width="1.6" fill="none"/>
                <path d="M569 456 C 573 474 596 479 605 465 L 605 477 C 597 490 573 488 568 470 Z" fill="#eef3f6"/>
                <path d="M573 462 l26 -6 M574 469 l24 -5" stroke="rgba(150,165,178,.5)" stroke-width="1.2"/>
                <path d="M604 462 l7 -4" stroke="#dfe6ea" stroke-width="2"/>
                <path d="M567 450 a18 18 0 0 1 36 0 z" fill="url(#capG)" transform="rotate(-11 585 450)"/>
                <path d="M571 443 a16 13 0 0 1 22 -6" stroke="rgba(255,255,255,.2)" stroke-width="2.4" fill="none"/>
                <path d="M566 452 q-3 4 -6 4" stroke="#2e5a8d" stroke-width="2" fill="none"/>
              </g>
              <g id="docArmNear">
                <path d="M571 494 L604 534" stroke="#2e6474" stroke-width="15" fill="none" stroke-linecap="round"/>
                <path d="M573 497 L601 531" stroke="rgba(0,0,0,.18)" stroke-width="4" fill="none" stroke-linecap="round"/>
                <circle cx="606" cy="536" r="7" fill="#2a5d6d"/>
                <path d="M608 538 L646 552" stroke="#326979" stroke-width="13" fill="none" stroke-linecap="round"/>
                <path d="M640 545 l6 12" stroke="rgba(0,0,0,.2)" stroke-width="3"/>
                <path d="M646 546 C 656 541 663 547 661 556 C 659 564 648 565 643 558 Z" fill="#9fc2cf"/>
                <path d="M648 548 q6 2 8 6" stroke="rgba(70,100,115,.5)" stroke-width="1.6" fill="none"/>
              </g>
              <circle id="handGlow" cx="656" cy="445" r="10" fill="rgba(210,242,255,.85)" filter="url(#ob4)" opacity="0"/>
            </g>

            <!-- floor sheen -->
            <ellipse cx="830" cy="806" rx="330" ry="26" fill="url(#floorPoolG)"/>
            <rect x="1246" y="782" width="232" height="70" fill="rgba(80,220,190,.035)"/>
            <ellipse cx="830" cy="796" rx="200" ry="9" fill="rgba(255,240,200,.05)"/>
            <rect width="1600" height="900" filter="url(#orGrainF)" opacity=".55"/>
          </svg>
        </div>
