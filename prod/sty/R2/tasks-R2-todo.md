# web-R2 Re:Connect 리스킨 계획 (단독 구현)

데이터/라우팅층 무수정: js/api.js, js/config.js, js/store.js, js/router.js, devserver.py

## 작업
- [ ] index.html: Tailwind CDN + tailwind.config(brand/boxShadow) + Lucide + Pretendard. 셸 마크업(masthead/main/footer/toast/modal) 유지.
- [ ] styles.css 전면 재작성: Re:Connect 토큰
      - brand 보라 스케일(50~900), slate 뉴트럴
      - glass-nav, gradient-text(.view-title em), shadow-soft/card/glow
      - rounded 3xl 카드, 컬러 아이콘칩, blob 배경, fadeIn/float/hover-lift
      - 기존 클래스 계약 100% 보존(.view .panel .btn .gcard .pill .chip .board .fit-* .crew-* .trend-* .pay-* .desk-* .lens-* .redact 등)
- [ ] app.js: 글래스 마스트헤드 = 보라 아이콘+워드마크 brand + 10기능 nav + 역할 스위처 + health dot + 모바일 햄버거 메뉴(리스트+하단 dark 버튼).
- [ ] ui.js: 헬퍼 시그니처 유지, Lucide 아이콘으로 교체(icon/catIcon), pill/chip/badge/swatch/state Re:Connect 톤.
- [ ] sourcing.js: 첫 화면 hero(그라데이션 헤드라인 + 플로팅 목업 카드) 보강. 데이터포인트 보존.
- [ ] 검증: devserver :8812 → playwright 데스크톱/모바일 sourcing/fit/track/crew/sponsor 스크린샷, 콘솔 0, 역할 게이팅/ON Fit 흐름.
</content>
</invoke>
