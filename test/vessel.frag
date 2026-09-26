<!-- vessel interior, revealed while the camera dives through the chest -->
        <div class="or-vessel" aria-hidden="true">
          <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
            <defs>
              <radialGradient id="vBg" cx="50%" cy="46%" r="78%">
                <stop offset="0" stop-color="#4b101b"/>
                <stop offset=".55" stop-color="#2b0a13"/>
                <stop offset="1" stop-color="#120409"/>
              </radialGradient>
              <radialGradient id="vWall" cx="50%" cy="50%" r="50%">
                <stop offset=".55" stop-color="rgba(255,120,130,0)"/>
                <stop offset=".8" stop-color="rgba(255,120,130,.14)"/>
                <stop offset=".93" stop-color="rgba(165,35,50,.4)"/>
                <stop offset="1" stop-color="rgba(42,6,13,.96)"/>
              </radialGradient>
              <radialGradient id="rbcG" cx="42%" cy="36%" r="78%">
                <stop offset="0" stop-color="#c23840"/>
                <stop offset=".38" stop-color="#e4574e"/>
                <stop offset=".72" stop-color="#b52f38"/>
                <stop offset="1" stop-color="#6d1520"/>
              </radialGradient>
              <radialGradient id="wbcG" cx="40%" cy="36%" r="75%">
                <stop offset="0" stop-color="#f6eef4"/>
                <stop offset=".65" stop-color="#d3bccb"/>
                <stop offset="1" stop-color="#8f6f85"/>
              </radialGradient>
              <linearGradient id="vTissG" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="#cf5666"/>
                <stop offset=".5" stop-color="#a02c40"/>
                <stop offset="1" stop-color="#5c1220"/>
              </linearGradient>
              <radialGradient id="vHalo" cx="50%" cy="50%" r="50%">
                <stop offset="0" stop-color="rgba(255,196,175,.55)"/>
                <stop offset=".55" stop-color="rgba(230,110,110,.22)"/>
                <stop offset="1" stop-color="rgba(230,110,110,0)"/>
              </radialGradient>
              <radialGradient id="vVig" cx="50%" cy="48%" r="62%">
                <stop offset="0" stop-color="rgba(10,2,6,0)"/>
                <stop offset=".72" stop-color="rgba(10,2,6,0)"/>
                <stop offset="1" stop-color="rgba(8,2,5,.75)"/>
              </radialGradient>
              <filter id="ov2"><feGaussianBlur stdDeviation="2"/></filter>
              <filter id="ov6"><feGaussianBlur stdDeviation="6"/></filter>
            </defs>
            <rect width="1600" height="900" fill="url(#vBg)"/>
            <!-- walls + endothelial irregularities rush outward together -->
            <g class="v-wall" style="--wd:0s">
              <path d="M800 60 C 1080 72 1350 240 1352 442 C 1354 644 1078 812 798 820 C 518 828 248 650 246 444 C 244 240 520 48 800 60 Z" fill="url(#vWall)"/>
              <ellipse cx="1184" cy="198" rx="90" ry="46" fill="rgba(96,16,28,.55)" filter="url(#ov6)"/>
              <ellipse cx="480" cy="666" rx="84" ry="42" fill="rgba(96,16,28,.5)" filter="url(#ov6)"/>
            </g>
            <g class="v-wall" style="--wd:.95s">
              <path d="M806 66 C 1070 80 1336 246 1338 440 C 1340 636 1072 806 800 814 C 528 822 262 646 260 442 C 258 246 540 52 806 66 Z" fill="url(#vWall)"/>
              <ellipse cx="1152" cy="630" rx="64" ry="34" fill="rgba(90,14,26,.5)" filter="url(#ov6)"/>
            </g>
            <g class="v-wall" style="--wd:1.9s">
              <path d="M794 54 C 1090 66 1364 236 1366 444 C 1368 652 1086 818 796 826 C 506 834 234 654 232 446 C 230 238 498 42 794 54 Z" fill="url(#vWall)"/>
              <ellipse cx="800" cy="108" rx="58" ry="30" fill="rgba(110,20,32,.45)" filter="url(#ov6)"/>
            </g>
            <g class="v-wall" style="--wd:2.85s">
              <path d="M800 62 C 1084 74 1352 242 1354 442 C 1356 642 1080 810 798 818 C 516 826 250 648 248 444 C 246 242 516 50 800 62 Z" fill="url(#vWall)"/>
              <ellipse cx="384" cy="198" rx="76" ry="40" fill="rgba(96,16,28,.5)" filter="url(#ov6)"/>
            </g>
            <g class="v-cells">
              <!-- near field: big, fast, motion-blurred -->
              <ellipse class="rbc" style="--dl:.0s;  --du:2.3s; --sx:-360px; --sy:-210px; --rr:52deg;  --bl:2px"  cx="800" cy="440" rx="52" ry="38" fill="url(#rbcG)"/>
              <ellipse class="rbc" style="--dl:.9s;  --du:2.2s; --sx:380px;  --sy:230px;  --rr:-40deg; --bl:2px"  cx="800" cy="440" rx="56" ry="40" fill="url(#rbcG)"/>
              <circle   class="rbc" style="--dl:1.8s; --du:2.5s; --sx:-140px; --sy:300px; --rr:30deg;  --bl:3px" cx="800" cy="440" r="40" fill="url(#wbcG)"/>
              <!-- mid field -->
              <ellipse class="rbc" style="--dl:.4s;  --du:2.7s; --sx:-300px; --sy:-170px; --rr:24deg;  --bl:0px"  cx="800" cy="440" rx="44" ry="32" fill="url(#rbcG)"/>
              <ellipse class="rbc" style="--dl:1.2s; --du:2.6s; --sx:300px;  --sy:-150px; --rr:-64deg; --bl:0px"  cx="800" cy="440" rx="40" ry="29" fill="url(#rbcG)"/>
              <ellipse class="rbc" style="--dl:2.0s; --du:2.9s; --sx:-110px; --sy:240px;  --rr:70deg;  --bl:0px"  cx="800" cy="440" rx="46" ry="33" fill="url(#rbcG)"/>
              <ellipse class="rbc" style="--dl:2.7s; --du:2.5s; --sx:250px;  --sy:210px;  --rr:-26deg; --bl:0px"  cx="800" cy="440" rx="36" ry="26" fill="url(#rbcG)"/>
              <ellipse class="rbc" style="--dl:3.3s; --du:2.8s; --sx:60px;   --sy:-310px; --rr:84deg;  --bl:0px"  cx="800" cy="440" rx="42" ry="30" fill="url(#rbcG)"/>
              <ellipse class="rbc" style="--dl:4.0s; --du:2.6s; --sx:-390px; --sy:60px;   --rr:-18deg; --bl:0px"  cx="800" cy="440" rx="38" ry="27" fill="url(#rbcG)"/>
              <circle   class="rbc" style="--dl:1.6s; --du:3.1s; --sx:190px; --sy:-270px; --rr:20deg;  --bl:1px"  cx="800" cy="440" r="30" fill="url(#wbcG)"/>
              <circle   class="rbc" style="--dl:3.8s; --du:2.9s; --sx:-250px; --sy:-90px; --rr:-34deg; --bl:1px" cx="800" cy="440" r="25" fill="url(#wbcG)"/>
              <!-- far field: small, dim, blurred -->
              <ellipse class="rbc" style="--dl:.7s;  --du:3.6s; --sx:-90px;  --sy:-70px;  --rr:40deg;  --bl:4px"  cx="800" cy="440" rx="22" ry="16" fill="url(#rbcG)" opacity=".7"/>
              <ellipse class="rbc" style="--dl:1.5s; --du:3.8s; --sx:100px;  --sy:60px;   --rr:-50deg; --bl:4px"  cx="800" cy="440" rx="19" ry="14" fill="url(#rbcG)" opacity=".65"/>
              <ellipse class="rbc" style="--dl:2.4s; --du:3.4s; --sx:-50px;  --sy:110px;  --rr:14deg;  --bl:4px"  cx="800" cy="440" rx="24" ry="17" fill="url(#rbcG)" opacity=".7"/>
              <ellipse class="rbc" style="--dl:3.0s; --du:3.7s; --sx:70px;   --sy:-120px; --rr:-30deg; --bl:4px"  cx="800" cy="440" rx="17" ry="12" fill="url(#rbcG)" opacity=".6"/>
              <circle   class="rbc" style="--dl:2.1s; --du:4.0s; --sx:40px;  --sy:-40px;  --rr:0deg;   --bl:5px"  cx="800" cy="440" r="14" fill="url(#wbcG)" opacity=".55"/>
              <!-- platelets -->
              <circle class="rbc" style="--dl:.8s;  --du:2.4s; --sx:120px; --sy:120px;  --rr:0deg; --bl:0px" cx="800" cy="440" r="8" fill="#ffd9c9"/>
              <circle class="rbc" style="--dl:2.5s; --du:2.6s; --sx:-90px; --sy:-210px; --rr:0deg; --bl:1px" cx="800" cy="440" r="6" fill="#ffd9c9"/>
              <circle class="rbc" style="--dl:4.2s; --du:2.5s; --sx:310px; --sy:110px;  --rr:0deg; --bl:0px" cx="800" cy="440" r="7" fill="#ffd9c9"/>
            </g>
            <g class="v-streaks" stroke="rgba(255,175,165,.16)" stroke-width="3" fill="none" stroke-linecap="round">
              <path class="vs" style="--sd:.2s"  d="M300 700 C 480 560, 700 540, 900 560"/>
              <path class="vs" style="--sd:1.4s" d="M1200 220 C 1000 320, 820 340, 660 320"/>
              <path class="vs" style="--sd:2.6s" d="M240 260 C 420 340, 560 360, 700 350"/>
              <path class="vs" style="--sd:3.2s" d="M1360 620 C 1180 560, 1020 570, 900 600"/>
              <path class="vs" style="--sd:1.9s" d="M420 160 C 600 240, 760 260, 880 240"/>
            </g>
            <!-- the heart ahead: grows as the camera flies into it -->
            <g id="vHeartG">
              <circle class="v-halo" r="300" fill="url(#vHalo)"/>
              <g class="v-throb">
                <g transform="translate(-210 -218) scale(.66)">
                  <path d="M318 152 C 326 88 392 58 446 88 C 490 112 494 168 458 198 L 442 182 C 470 156 466 122 432 104 C 392 82 346 102 338 158 Z" fill="#b04256"/>
                  <path d="M262 150 C 236 100 168 92 138 124 C 116 148 122 178 146 194 L 158 178 C 142 166 138 148 154 136 C 176 118 226 126 246 164 Z" fill="#9c3850"/>
                  <circle cx="196" cy="212" r="60" fill="#b8414f"/>
                  <circle cx="452" cy="216" r="54" fill="#a03344"/>
                  <path d="M322 148 C 262 92 148 116 128 224 C 110 330 178 452 252 540 C 290 586 350 586 388 540 C 462 452 530 330 512 224 C 492 116 382 92 322 148 Z" fill="url(#vTissG)"/>
                  <path d="M252 540 C 290 586 350 586 388 540 C 420 502 452 456 476 408 C 430 476 340 520 268 500 Z" fill="rgba(50,8,16,.4)"/>
                  <ellipse cx="250" cy="240" rx="80" ry="110" fill="rgba(255,190,185,.24)" filter="url(#ov6)"/>
                  <g fill="none" stroke-linecap="round">
                    <path d="M330 172 C 320 262 300 362 282 468" stroke="rgba(255,150,130,.6)" stroke-width="7"/>
                    <path d="M244 190 C 202 252 192 332 222 420" stroke="rgba(245,125,105,.5)" stroke-width="5"/>
                    <path d="M424 208 C 454 278 444 342 402 404" stroke="rgba(245,125,105,.45)" stroke-width="4"/>
                  </g>
                </g>
              </g>
            </g>
            <rect width="1600" height="900" fill="url(#vVig)"/>
          </svg>
        </div>
