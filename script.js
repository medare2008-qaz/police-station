// 게시물은 이 배열만 수정하면 알림마당에 표시됩니다.
const notices = [
  { category: "notice", label: "공지사항", title: "한빛경찰서 홈페이지 시안 안내", date: "2026.10.26" },
  { category: "press", label: "보도자료", title: "지역 주민과 함께하는 안전 캠페인 안내 (예시)", date: "2026.10.22" },
  { category: "notice", label: "공지사항", title: "민원 서비스 이용 전 확인해 주세요", date: "2026.10.18" },
  { category: "press", label: "보도자료", title: "가을철 보행자 교통안전 안내 (예시)", date: "2026.10.12" }
];

const noticeList = document.querySelector("#notices-list");
const noticeTabs = document.querySelectorAll(".notice-tab");
const contentSearch = document.querySelector("#content-search");
const clearSearch = document.querySelector("#clear-search");
const searchSummary = document.querySelector("#search-summary");
const resourceEmpty = document.querySelector("#resource-empty");
let activeNoticeCategory = "all";

// 시민 안전 포스터를 자동으로 전환하며, 모바일에서는 좌우 스와이프로 이동할 수 있습니다.
const posterCarousel = document.querySelector(".poster-carousel");
if (posterCarousel) {
  const slides = [...posterCarousel.querySelectorAll(".poster-slide")];
  const dots = [...document.querySelectorAll(".poster-dot")];
  const pauseButton = document.querySelector(".poster-pause");
  let currentPoster = 0;
  let rotationTimer;
  let touchStartX = null;
  let touchStartY = null;
  let rotationPaused = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (pauseButton && rotationPaused) {
    pauseButton.textContent = "자동 넘김 시작";
    pauseButton.setAttribute("aria-pressed", "true");
  }

  function showPoster(index) {
    currentPoster = (index + slides.length) % slides.length;
    slides.forEach((slide, item) => {
      const active = item === currentPoster;
      slide.classList.toggle("is-active", active);
      slide.setAttribute("aria-hidden", String(!active));
    });
    dots.forEach((dot, item) => {
      const active = item === currentPoster;
      dot.classList.toggle("is-active", active);
      dot.setAttribute("aria-pressed", String(active));
    });
  }

  function startRotation() {
    window.clearInterval(rotationTimer);
    if (!rotationPaused) rotationTimer = window.setInterval(() => showPoster(currentPoster + 1), 5000);
  }

  posterCarousel.querySelector(".poster-prev")?.addEventListener("click", () => { showPoster(currentPoster - 1); startRotation(); });
  posterCarousel.querySelector(".poster-next")?.addEventListener("click", () => { showPoster(currentPoster + 1); startRotation(); });
  dots.forEach((dot, index) => dot.addEventListener("click", () => { showPoster(index); startRotation(); }));
  posterCarousel.addEventListener("touchstart", (event) => {
    const touch = event.changedTouches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
  }, { passive: true });
  posterCarousel.addEventListener("touchend", (event) => {
    if (touchStartX === null || touchStartY === null) return;
    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - touchStartX;
    const deltaY = touch.clientY - touchStartY;
    touchStartX = null;
    touchStartY = null;
    if (Math.abs(deltaX) < 40 || Math.abs(deltaX) <= Math.abs(deltaY)) return;
    showPoster(currentPoster + (deltaX < 0 ? 1 : -1));
    startRotation();
  }, { passive: true });
  posterCarousel.addEventListener("touchcancel", () => {
    touchStartX = null;
    touchStartY = null;
  }, { passive: true });
  pauseButton?.addEventListener("click", () => {
    rotationPaused = !rotationPaused;
    pauseButton.setAttribute("aria-pressed", String(rotationPaused));
    pauseButton.textContent = rotationPaused ? "자동 넘김 시작" : "자동 넘김 멈춤";
    startRotation();
  });
  posterCarousel.addEventListener("mouseenter", () => window.clearInterval(rotationTimer));
  posterCarousel.addEventListener("mouseleave", startRotation);
  posterCarousel.addEventListener("focusin", () => window.clearInterval(rotationTimer));
  posterCarousel.addEventListener("focusout", (event) => { if (!posterCarousel.contains(event.relatedTarget)) startRotation(); });
  document.addEventListener("visibilitychange", () => document.hidden ? window.clearInterval(rotationTimer) : startRotation());
  startRotation();
}

function renderContentSearch() {
  const query = contentSearch?.value.trim().toLocaleLowerCase() || "";
  const matchingNotices = notices.filter((notice) => {
    const categoryMatches = activeNoticeCategory === "all" || notice.category === activeNoticeCategory;
    const textMatches = !query || `${notice.label} ${notice.title} ${notice.date}`.toLocaleLowerCase().includes(query);
    return categoryMatches && textMatches;
  });
  noticeList.innerHTML = matchingNotices.length ? matchingNotices.map((notice) => `
    <article class="notice-row" data-category="${notice.category}">
      <span class="notice-type">${notice.label}</span>
      <span class="notice-title">${notice.title}</span>
      <time class="notice-date">${notice.date}</time>
    </article>`).join("") : '<p class="search-empty">검색 조건에 맞는 공지사항이 없습니다.</p>';

  const resourceCards = [...document.querySelectorAll(".resource-card")];
  const matchingResources = resourceCards.filter((card) => {
    const matches = !query || card.textContent.toLocaleLowerCase().includes(query);
    card.hidden = !matches;
    return matches;
  });
  if (resourceEmpty) resourceEmpty.hidden = !query || matchingResources.length > 0;
  if (searchSummary) {
    searchSummary.textContent = query
      ? `검색 결과: 공지사항 ${matchingNotices.length}건 · 안전 자료 ${matchingResources.length}건`
      : "공지사항과 시민 안전 자료를 한 번에 찾습니다.";
  }
}

if (noticeList) {
  renderContentSearch();
  noticeTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      noticeTabs.forEach((item) => {
        const selected = item === tab;
        item.classList.toggle("active", selected);
        item.setAttribute("aria-selected", String(selected));
      });
      activeNoticeCategory = tab.dataset.category;
      renderContentSearch();
    });
  });
  contentSearch?.addEventListener("input", renderContentSearch);
  clearSearch?.addEventListener("click", () => {
    contentSearch.value = "";
    activeNoticeCategory = "all";
    noticeTabs.forEach((tab) => {
      const selected = tab.dataset.category === "all";
      tab.classList.toggle("active", selected);
      tab.setAttribute("aria-selected", String(selected));
    });
    renderContentSearch();
    contentSearch.focus();
  });
}

// data-modal 속성이 있는 모든 버튼은 해당 ID의 팝업을 엽니다.
document.querySelectorAll("[data-modal]").forEach((trigger) => {
  trigger.addEventListener("click", () => {
    const modal = document.getElementById(trigger.dataset.modal);
    if (modal) {
      modal.showModal();
      document.documentElement.classList.add("modal-open");
      document.body.classList.add("modal-open");
    }
  });
});

// 팝업 바깥을 누르면 닫습니다.
document.querySelectorAll(".site-modal").forEach((modal) => {
  modal.addEventListener("click", (event) => {
    if (event.target === modal) modal.close();
  });
  modal.addEventListener("close", () => {
    if (!document.querySelector(".site-modal[open]")) {
      document.documentElement.classList.remove("modal-open");
      document.body.classList.remove("modal-open");
    }
  });
});

// 제외 여부는 접수 버튼을 눌렀을 때만 작성 내용을 확인해 안내합니다.
const inquiryForm = document.querySelector("#inquiry-form");
const exclusionReasonLabels = {
  agency: "행정기관이 행정기관에 요구하는 경우",
  contract: "민원 관련 사법상 계약관계의 당사자인 경우",
  unclear: "성명·주소 등이 불명확한 경우",
};

if (inquiryForm) {
const exclusionReview = document.querySelector("#exclusion-review");
const reviewMessage = document.querySelector("#review-message");
const reviewResults = document.querySelector("#review-results");
let reviewedText = "";
let reviewedFindings = [];

const exclusionRules = [
  {
    id: "agency",
    label: exclusionReasonLabels.agency,
    pattern: /(?:행정기관|공공단체|공공기관|정부기관)(?:이|가|은|는|에서).{0,70}?(?:다른\s*)?행정기관.{0,50}?(?:요구|요청|신청|처분|조치)/g,
  },
  {
    id: "contract",
    label: exclusionReasonLabels.contract,
    pattern: /(?:행정기관과\s*)?사법(?:상|상의)\s*계약관계.{0,70}?(?:행정기관에?\s*)?(?:요구|요청|신청|처분|조치)/g,
  },
  {
    id: "unclear",
    label: exclusionReasonLabels.unclear,
    pattern: /(?:성명|이름|주소).{0,12}?(?:불명확|불분명|분명하지\s*아니|분명하지\s*않|미상|미기재|미작성|없음)|익명|무기명/gu,
  },
];

function findExclusionFindings(text) {
  const findings = [];
  for (const rule of exclusionRules) {
    rule.pattern.lastIndex = 0;
    const match = rule.pattern.exec(text);
    if (match) findings.push({ id: rule.id, label: rule.label, text: match[0] });
  }
  return findings;
}

function renderExclusionReview(findings) {
  reviewResults.innerHTML = findings.map((finding) => `
    <article class="exclusion-result">
      <strong>${escapeHtml(finding.label)}</strong>
      <p>“<mark>${escapeHtml(finding.text)}</mark>”</p>
    </article>`).join("");
  exclusionReview.hidden = findings.length === 0;
  if (findings.length) {
    reviewMessage.textContent = "작성한 내용에 민원인에서 제외되는 경우와 비슷한 문구가 있습니다. 아래 문구를 확인해 주세요. 자동 안내이며 최종 판단은 담당 기관이 합니다.";
    reviewMessage.classList.add("has-exclusion");
  } else {
    reviewMessage.textContent = "제외 대상에 해당하는 문구가 자동으로 확인되지 않았습니다.";
    reviewMessage.classList.remove("has-exclusion");
  }
}

inquiryForm.addEventListener("input", () => {
  reviewedText = "";
  reviewedFindings = [];
  exclusionReview.hidden = true;
  const submitButton = inquiryForm.querySelector("[type=submit]");
  submitButton.textContent = "민원 접수하기";
});

// 민원 내용은 접수 요청을 보낸 뒤 서버에 저장되고 접수번호가 발급됩니다.
inquiryForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const feedback = form.closest(".site-modal")?.querySelector(".form-feedback") || form.nextElementSibling;
  const submitButton = form.querySelector("[type=submit]");
  const formValues = Object.fromEntries(new FormData(form));
  const textToReview = `${formValues.title}\n${formValues.content}`;

  // 첫 클릭에서는 내용이 작성된 경우에만 분석 결과를 보여주고 전송을 멈춥니다.
  if (reviewedText !== textToReview) {
    reviewedText = textToReview;
    reviewedFindings = findExclusionFindings(textToReview);
    renderExclusionReview(reviewedFindings);
    if (reviewedFindings.length) {
      feedback.textContent = "표시된 문구를 확인한 뒤에도 접수를 원하면 ‘확인 후 접수하기’를 눌러 주세요.";
      feedback.classList.add("has-exclusion");
      submitButton.textContent = "확인 후 접수하기";
      exclusionReview.scrollIntoView({ behavior: "smooth", block: "nearest" });
      return;
    }
  }

  submitButton.disabled = true;
  feedback.textContent = "접수 중입니다…";
  feedback.classList.remove("has-exclusion");
  try {
    const response = await fetch("/api/inquiries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...formValues, exclusionFindings: reviewedFindings.map(({ id, label }) => ({ id, label })) })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "접수에 실패했습니다.");
    feedback.textContent = `접수되었습니다. 접수번호: ${result.id}`;
    form.reset();
    reviewedText = "";
    reviewedFindings = [];
    exclusionReview.hidden = true;
    submitButton.textContent = "민원 접수하기";
  } catch (error) {
    feedback.textContent = error.message === "Failed to fetch"
      ? "서버에 연결할 수 없습니다. node server.js 실행 주소에서 홈페이지를 열어 주세요."
      : error.message;
  } finally {
    submitButton.disabled = false;
  }
});
}

const adminLoginForm = document.querySelector("#admin-login-form");
const adminFeedback = document.querySelector("#admin-feedback");
const adminPanel = document.querySelector("#admin-panel");
const adminFilters = document.querySelector("#admin-filters");
const adminCategories = ["전체", "일반 문의", "불편·건의", "교통 관련 문의", "기타"];
let adminRequests = [];
let activeAdminCategory = "전체";

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

if (adminLoginForm) {
async function loadAdminRequests() {
  const response = await fetch("/api/admin/requests");
  if (!response.ok) throw new Error("로그인이 필요합니다.");
  adminRequests = await response.json();
  renderAdminRequests();
}

function renderAdminRequests() {
  const list = document.querySelector("#admin-requests");
  if (!adminRequests.length) {
    adminFilters.hidden = true;
    list.innerHTML = '<p class="empty-requests">아직 접수된 민원이 없습니다.</p>';
    return;
  }
  adminFilters.hidden = false;
  adminFilters.innerHTML = adminCategories.map((category) => {
    const count = category === "전체" ? adminRequests.length : adminRequests.filter((request) => request.category === category).length;
    return `<button class="admin-filter ${category === activeAdminCategory ? "active" : ""}" type="button" data-admin-category="${escapeHtml(category)}" aria-pressed="${category === activeAdminCategory}">${escapeHtml(category)}<span>${count}</span></button>`;
  }).join("");
  adminFilters.querySelectorAll("[data-admin-category]").forEach((button) => {
    button.addEventListener("click", () => {
      activeAdminCategory = button.dataset.adminCategory;
      renderAdminRequests();
    });
  });

  const visibleRequests = activeAdminCategory === "전체"
    ? adminRequests
    : adminRequests.filter((request) => request.category === activeAdminCategory);
  if (!visibleRequests.length) {
    list.innerHTML = '<p class="empty-requests">이 종류로 접수된 민원이 없습니다.</p>';
    return;
  }
  list.innerHTML = visibleRequests.map((request) => {
    const details = `
      <div class="admin-request-top"><span class="admin-request-id">${escapeHtml(request.id)}</span><div class="admin-request-meta"><time>${escapeHtml(request.createdAt)}</time><button class="delete-request" type="button" data-delete-request="${escapeHtml(request.id)}" aria-label="접수번호 ${escapeHtml(request.id)} 민원 삭제">삭제</button></div></div>
      <span class="admin-request-category">${escapeHtml(request.category)}</span>
      ${exclusionReasonLabels[request.excludedReason] ? `<span class="admin-exclusion">분류 · ${escapeHtml(exclusionReasonLabels[request.excludedReason])}</span>` : ""}
      <h3>${escapeHtml(request.title)}</h3>
      <p>${escapeHtml(request.content).replace(/\n/g, "<br>")}</p>
      <span class="request-status ${request.status === "답변 완료" ? "is-complete" : ""}">상태 · ${escapeHtml(request.status)}</span>
      <label class="reply-field">관리자 답변<textarea data-reply="${escapeHtml(request.id)}" rows="3" maxlength="2000" placeholder="민원인에게 전달할 답변을 입력해 주세요.">${escapeHtml(request.reply || "")}</textarea></label>
      <button class="button button-navy reply-save" type="button" data-save-reply="${escapeHtml(request.id)}">${request.reply ? "답변 수정 저장" : "답변 저장"}</button>`;
    if (request.status === "답변 완료") {
      return `<details class="admin-request completed-request"><summary class="completed-summary"><span class="admin-request-id">${escapeHtml(request.id)}</span><span class="admin-request-category">${escapeHtml(request.category)}</span><strong>${escapeHtml(request.title)}</strong></summary><div class="completed-details">${details}</div></details>`;
    }
    return `<article class="admin-request">${details}</article>`;
  }).join("");
  list.querySelectorAll("[data-delete-request]").forEach((button) => {
    button.addEventListener("click", async () => {
      const requestId = button.dataset.deleteRequest;
      if (!window.confirm(`접수번호 ${requestId} 민원을 삭제할까요? 삭제한 민원은 복구할 수 없습니다.`)) return;
      button.disabled = true;
      const response = await fetch(`/api/admin/requests/${encodeURIComponent(requestId)}`, { method: "DELETE" });
      if (!response.ok) {
        button.disabled = false;
        adminFeedback.textContent = "민원 삭제에 실패했습니다. 로그인 상태를 확인해 주세요.";
        return;
      }
      adminFeedback.textContent = "민원을 삭제했습니다.";
      await loadAdminRequests();
    });
  });
  list.querySelectorAll("[data-save-reply]").forEach((button) => {
    button.addEventListener("click", async () => {
      const replyInput = list.querySelector(`[data-reply="${CSS.escape(button.dataset.saveReply)}"]`);
      const reply = replyInput.value.trim();
      if (!reply) {
        adminFeedback.textContent = "답변 내용을 입력해 주세요.";
        replyInput.focus();
        return;
      }
      button.disabled = true;
      const response = await fetch(`/api/admin/requests/${encodeURIComponent(button.dataset.saveReply)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reply })
      });
      button.disabled = false;
      if (!response.ok) {
        adminFeedback.textContent = "답변 저장에 실패했습니다. 다시 로그인한 뒤 시도해 주세요.";
        return;
      }
      adminFeedback.textContent = "답변을 저장했고 상태를 ‘답변 완료’로 변경했습니다.";
      await loadAdminRequests();
    });
  });
}

adminLoginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = adminLoginForm.querySelector("[type=submit]");
  submitButton.disabled = true;
  adminFeedback.textContent = "로그인 중…";
  try {
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(new FormData(adminLoginForm)))
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "로그인에 실패했습니다.");
    adminLoginForm.reset();
    adminLoginForm.hidden = true;
    adminPanel.hidden = false;
    adminFeedback.textContent = "로그인되었습니다.";
    await loadAdminRequests();
  } catch (error) {
    adminLoginForm.hidden = false;
    adminPanel.hidden = true;
    adminFeedback.textContent = error.message === "Failed to fetch" ? "서버에 연결할 수 없습니다. 홈페이지를 node server.js 실행 주소에서 열어 주세요." : error.message;
  } finally {
    submitButton.disabled = false;
  }
});

document.querySelector("#admin-logout").addEventListener("click", async () => {
  await fetch("/api/admin/logout", { method: "POST" });
  adminLoginForm.reset();
  adminLoginForm.hidden = false;
  adminPanel.hidden = true;
  adminFeedback.textContent = "로그아웃되었습니다.";
});

document.querySelector("#admin-modal").addEventListener("close", () => {
  adminLoginForm.reset();
  adminLoginForm.hidden = false;
  adminPanel.hidden = true;
  adminFeedback.textContent = "";
});
}

document.querySelectorAll(".resource-card").forEach((card) => {
  card.addEventListener("click", () => {
    document.querySelector("#resource-title").textContent = card.dataset.resource;
    document.querySelector("#resource-modal").showModal();
    document.documentElement.classList.add("modal-open");
    document.body.classList.add("modal-open");
  });
});

const menuToggle = document.querySelector(".menu-toggle");
const mainNav = document.querySelector(".main-nav");
menuToggle.addEventListener("click", () => {
  const isOpen = mainNav.classList.toggle("open");
  menuToggle.setAttribute("aria-expanded", String(isOpen));
  menuToggle.setAttribute("aria-label", isOpen ? "메뉴 닫기" : "메뉴 열기");
});
mainNav.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => {
  mainNav.classList.remove("open");
  menuToggle.setAttribute("aria-expanded", "false");
  menuToggle.setAttribute("aria-label", "메뉴 열기");
}));
// 스크립트의 초기화가 끝난 뒤 모바일에서는 메뉴 버튼으로 내비게이션을 제어합니다.
document.documentElement.classList.add("js-ready");
