"""Render index.html (the Vite entry) from template.html by filling in the numbered source list.

Usage: python3 build.py
"""

import html
import re
from pathlib import Path

ROOT = Path(__file__).parent
OM = "https://open-minutes.nickcrews.workers.dev/meetings/"
GBOS = "https://www.muni.org/Departments/operations/streets/Service/GBOS/"

# (number, description, original URL or None, archive/video URL or None, local copy path or None)
SOURCES = [
    (1, "Heritage Land Bank. Public Hearing Notice, HLBAC Resolution 2026-11 (Enstar, Parcel 6-062). Posted Nov 5, 2026.",
     "https://www.muni.org/Documents/Public%20Notices/2026/HLBAC_2026-11_Enstar_6-062_PHN.pdf", None, None),
    (2, "Heritage Land Bank Advisory Commission. Agenda, November 19, 2026.",
     "https://www.muni.org/Documents/Departments/Real%20Estate/Heritage%20Land%20Bank/2026%20Meetings/HLBAC_20261119_Agenda.pdf", None, None),
    (3, "Enstar (Steve Cooper). Letter to GBOS and DNR re ADL 234206, Aug 3, 2023.",
     GBOS + "2023%2008%2003%20ENSTAR%20Comments%20re%20ADL%20234206.pdf",
     "https://web.archive.org/web/20251108002010/" + GBOS + "2023%2008%2003%20ENSTAR%20Comments%20re%20ADL%20234206.pdf",
     "sources/enstar-2023-08-03-letter-to-gbos.pdf"),
    (4, "Girdwood Board of Supervisors. Letter of Objection: ADL 234206, July 19, 2023.",
     GBOS + "GBOS%20Objection%20to%20ADL%20234206.pdf",
     "https://web.archive.org/web/20260310163538/" + GBOS + "GBOS%20Objection%20to%20ADL%20234206.pdf",
     "sources/gbos-2023-07-19-objection-adl-234206.pdf"),
    (5, "Turnagain News. “Plan for gas line sparks heated reaction,” Jul 30, 2023.",
     "https://www.turnagainnews.org/articles/plan-for-gas-line-sparks-heated-reaction",
     "https://web.archive.org/web/20261115212848/https://www.turnagainnews.org/articles/plan-for-gas-line-sparks-heated-reaction", None),
    (6, "Turnagain News. “Enstar agrees to further review controversial gas line plan,” Aug 15, 2023.",
     "https://www.turnagainnews.org/articles/enstar-agrees-to-further-review-controversial-gas-line-plan",
     "https://web.archive.org/web/20261115214143/https://www.turnagainnews.org/articles/enstar-agrees-to-further-review-controversial-gas-line-plan", None),
    (7, "Turnagain News. “State OKs Gas Line through Virgin Creek Forest,” Sep 6, 2024.",
     "https://www.turnagainnews.org/articles/state-oks-gas-line-through-virgin-creek-forest",
     "https://web.archive.org/web/20261115214226/https://www.turnagainnews.org/articles/state-oks-gas-line-through-virgin-creek-forest", None),
    (8, "Turnagain News. “Girdwood Board reverses stance on Gas Line,” Sep 18, 2024.",
     "https://www.turnagainnews.org/articles/girdwood-board-reverses-stance-on-gas-line",
     "https://web.archive.org/web/20240920195059/https://www.turnagainnews.org/articles/girdwood-board-reverses-stance-on-gas-line", None),
    (9, "GBOS regular meeting, July 17, 2023 (Enstar item starts 43:03). Machine transcript on Open Minutes; video on YouTube; transcript excerpt copy.",
     OM + "25?t=2583", "https://www.youtube.com/watch?v=qae1FAlKgZs&t=2583s",
     "sources/transcripts/gbos-2023-07-17-enstar-item.txt"),
    (10, "GBOS special meeting, Sept 13, 2024. Machine transcript on Open Minutes; video on YouTube; transcript copy.",
     OM + "31", "https://www.youtube.com/watch?v=fQCo79vPops",
     "sources/transcripts/gbos-2024-09-13-special-meeting.txt"),
    (11, "GBOS. Minutes, special meeting Sept 13, 2024.",
     "https://muni.org/Departments/operations/streets/Service/GBOS/GBOS%20SM%209.13.24%20Re%20Section%20LIne%20Easement%20appeal%20and%20Project%20Anchorage%20minutes%20final.pdf",
     "https://web.archive.org/web/20250516073754/https://www.muni.org/Departments/operations/streets/Service/GBOS/GBOS%20SM%209.13.24%20Re%20Section%20LIne%20Easement%20appeal%20and%20Project%20Anchorage%20minutes%20final.pdf",
     "sources/gbos-2024-09-13-special-meeting-minutes.pdf"),
    (12, "Girdwood Land Use Committee. Minutes, Sept 9, 2024.",
     "https://muni.org/Departments/operations/streets/Service/Land%20Use%20Committee/LUC%20Sept%209%202024%20minutes%20final.pdf", None, None),
    (13, "Girdwood Land Use Committee. Minutes, May 11, 2026.",
     "https://www.muni.org/Departments/operations/streets/Service/Land%20Use%20Committee/LUC%20May%202026%20minutes%20final.pdf", None, None),
    (14, "GBOS. Meeting packet, Nov 16, 2026.",
     "https://www.muni.org/Documents/Departments/Maintenance%20and%20Operations/Street%20Maintenance/Municipal%20Road%20Maintenance%20Service%20Areas/Girdwood%20Board%20of%20Supervisors/GBOS%20Nov%2016%20meeting%20packet.pdf",
     None, None),
    (15, "HLBAC. Meeting packet, March 26, 2026 (a staff report citing AMC 25.40.025: HLBAC holds a hearing before recommending a disposal to the Mayor and Assembly).",
     "https://www.muni.org/Departments/hlb/SiteAssets/Pages/HLBCommission/HLBAC_20260326_Packet.pdf", None, None),
    (16, "Turnagain News (Chase Berenson). “Whittier natural gas shutdown shows vulnerability of communities outside the Anchorage bowl,” Sep 1, 2026.",
     "https://www.turnagainnews.org/articles/whittier-natural-gas-shutdown-shows-vulnerability-of-communities-outside-the-anchorage-bowl",
     "https://web.archive.org/web/20261115214453/https://www.turnagainnews.org/articles/whittier-natural-gas-shutdown-shows-vulnerability-of-communities-outside-the-anchorage-bowl", None),
    (17, "Anchorage Daily News. “Triggering a 3-week outage, Enstar shuts off gas to Whittier for pipeline repairs,” Aug 17, 2026.",
     "https://www.adn.com/alaska-news/2026/08/17/triggering-a-3-week-outage-enstar-shuts-off-gas-to-whittier-for-pipeline-repairs/",
     "https://web.archive.org/web/20260821040614/https://www.adn.com/alaska-news/2026/08/17/triggering-a-3-week-outage-enstar-shuts-off-gas-to-whittier-for-pipeline-repairs/", None),
    (18, "Alaska Public Media / KTOO. “Whittier gas restored after Enstar secures temporary LNG supply,” Aug 26, 2026.",
     "https://www.ktoo.org/2026/08/26/whittier-gas-restored-after-enstar-secures-temporary-lng-supply/",
     "https://web.archive.org/web/20260828073719/https://www.ktoo.org/2026/08/26/whittier-gas-restored-after-enstar-secures-temporary-lng-supply/", None),
    (19, "Enstar. “2026 Rabbit Creek Gas Line Re-route” project page.",
     "https://www.enstarnaturalgas.com/rabbit-creek/",
     "https://web.archive.org/web/20261115214830/https://www.enstarnaturalgas.com/rabbit-creek/", None),
    (20, "PHMSA. National Pipeline Performance Measures.",
     "https://www.phmsa.dot.gov/data-and-statistics/pipeline/national-pipeline-performance-measures",
     "https://web.archive.org/web/20261022002827/https://www.phmsa.dot.gov/data-and-statistics/pipeline/national-pipeline-performance-measures", None),
    (21, "Radio Kenai. “ENSTAR Clarifies Rate Hike Impact as Southcentral Faces a Shrinking Gas Supply,” 2025.",
     "https://radiokenai.com/?p=186607",
     "https://web.archive.org/web/20261115214859/https://radiokenai.com/enstar-clarifies-rate-hike-impact-as-southcentral-faces-a-shrinking-gas-supply/", None),
    (22, "Alaska DNR, Division of Mining, Land and Water. Title information (section-line easements).",
     "https://dnr.alaska.gov/mlw/landsales/info/title-information/",
     "https://web.archive.org/web/20260517151356/https://dnr.alaska.gov/mlw/landsales/info/title-information/", None),
    (23, "Alaska DNR. Public Notice, ADL 234206, July 6, 2023.",
     "https://aws.state.ak.us/OnlinePublicNotices/Notices/View.aspx?id=211721", None,
     "sources/2023-07-06-dnr-public-notice-adl-234206.pdf"),
    (24, "Alaska DNR. Agency Review Notice, comment period extended to Aug 3, 2023 (July 19, 2023), with application attached.",
     None, None, "sources/2023-07-dnr-extended-public-notice-adl-234206.pdf"),
    (25, "Enstar. Application for Easement ADL 234206 (redacted), development narrative and construction drawings “Girdwood Townsite Reinforcement,” May 2023.",
     None, None, "sources/2023-enstar-application-adl-234206-redacted.pdf"),
    (26, "Alaska DNR (Yannick Calvez). Public-notice map, ADL 234206, June 30, 2023.",
     None, None, "sources/2023-enstar-route-map.pdf"),
    (27, "Enstar. “ADL 234206 – Response to Request for Project Information,” answers to GBOS questions, July 2023.",
     None, None, "sources/2023-07-enstar-answers-to-gbos-questions.pdf"),
    (28, "GBOS. Minutes, regular meeting July 17, 2023 (converted from the original .doc).",
     None, None, "sources/2023-07-17-gbos-minutes.pdf"),
    (29, "Alaska DNR, Southcentral Regional Land Office (Jay Rokos). ADL 234206 decision: non-objection to developing the section-line easement, with public-comment responses. Signed Aug 26, 2024. 21 pages.",
     None, None, "sources/2024-08-dnr-signed-decision-adl-234206.pdf"),
    (30, "Enstar status update relayed by GBOS (Briana Sullivan) to Girdwood staff, Sept 9, 2024.",
     None, None, "sources/2024-09-enstar-update.pdf"),
    (31, "“Enstar similar photos,” July 2023 GBOS materials.",
     None, None, "sources/2023-07-enstar-similar-photos.docx"),
]


def render_sources() -> str:
    items = []
    for n, desc, orig, arch, copy in SOURCES:
        parts = []
        if orig:
            parts.append(f'<a href="{html.escape(orig)}">Original</a>')
        if arch:
            label = "Video" if "youtube.com" in arch else "Archive"
            parts.append(f'<a href="{html.escape(arch)}">{label}</a>')
        elif orig and not orig.startswith(OM):
            parts.append("<span>archive attempt failed</span>")
        if copy:
            parts.append(f'<a href="{copy}">Copy</a>')
        if not orig:
            parts.append("<span>not posted online that I found; from documents Girdwood staff sent GBOS on Nov 13, 2026</span>")
        items.append(
            f'    <li id="s{n}">{html.escape(desc)}<br><span class="arch">' + " · ".join(parts) + "</span></li>"
        )
    return "\n".join(items)


def main() -> None:
    template = (ROOT / "template.html").read_text()
    out = template.replace("<!--SOURCES-->", render_sources())
    cited = {int(x) for x in re.findall(r'href="#s(\d+)"', out)}
    defined = {n for n, *_ in SOURCES}
    missing = cited - defined
    unused = defined - cited
    if missing:
        raise SystemExit(f"cited but not defined: {sorted(missing)}")
    if unused:
        print(f"warning: defined but never cited: {sorted(unused)}")
    for _, _, _, _, copy in SOURCES:
        if copy and not (ROOT / "public" / copy).exists():
            raise SystemExit(f"missing local copy: {copy}")
    (ROOT / "index.html").write_text(out)
    print("wrote index.html")


if __name__ == "__main__":
    main()
