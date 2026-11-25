import { View, StyleSheet } from "react-native";
import NaverMapView from "../components/map/NaverMapView";
import BuildingSheet from "../components/map/BuildingSheet";
import FacilitySheet from "../components/map/FacilitySheet";
import MapFilterChips from "../components/map/MapFilterChips";
import MapActionMenu from "../components/map/MapActionMenu";
import ReportComposerModal from "../components/map/report/ReportComposerModal";
import InfoSuggestModal from "../components/settings/InfoSuggestModal";
import ReportSheet from "../components/map/report/ReportSheet";
import HotReportList from "../components/map/report/HotReportList";
import RetryableError from "../components/common/RetryableError";
import PartnerChips from "../components/map/partner/PartnerChips";
import PartnerSheet from "../components/map/partner/PartnerSheet";
import PartnerSearchModal from "../components/map/partner/PartnerSearchModal";
import PartnerNoticeModal from "../components/map/PartnerNoticeModal";
import NearbyFilterIntro from "../components/map/nearby/NearbyFilterIntro";
import LaunchNoticeModal from "../components/common/LaunchNoticeModal";
import { COLORS } from "../constants/colors";

import FloorDialSheet from "../components/map/FloorDialSheet";

/** 길찾기 도착을 핀으로 고를 때, 핀 아래 건물이 없으면 이만큼 안의 가장 가까운 건물을 도착으로 쓴다(11-12). */
import { canLocate } from "../lib/nearbyPartners/platform";
import { ROUTE_FINDING_ENABLED } from '../constants/route'
import RoutePlannerModal from "../components/map/route/RoutePlannerModal";
import MapTopBar from "../components/map/topbar/MapTopBar";
import MapSearchBar from "../components/map/topbar/MapSearchBar";
import FilterChipSection from "../components/map/topbar/FilterChipSection";
import LocationPickerOverlay from "../components/map/picker/LocationPickerOverlay";
import RouteStrip from "../components/map/route/RouteStrip";
import RouteResultCard from "../components/map/route/RouteResultCard";
import MapNoticeStack from "../components/map/notices/MapNoticeStack";
import MapDataStatusNotice from "../components/map/notices/MapDataStatusNotice";
import MapAuthErrorNotice from "../components/map/notices/MapAuthErrorNotice";
import ReportsLoadingNotice from "../components/map/notices/ReportsLoadingNotice";
import AskPlaceCard from "../components/map/notices/AskPlaceCard";
import ReviewPinNotice from "../components/map/notices/ReviewPinNotice";
import DismissibleNotice from "../components/map/notices/DismissibleNotice";
import NearbyTestPicker from "../components/map/nearby/NearbyTestPicker";
import NearbyOverlayNote from "../components/map/nearby/NearbyOverlayNote";
import MapSheets from "../components/map/sheets/MapSheets";
import { withRo } from "../utils/common/josa";
import { offscreenSummary } from "../utils/map/labels";
import { useMapScreen } from '../hooks/map/useMapScreen'

/** 경로 표시에 층을 병기한다. 층을 고르지 않았으면 건물명만. */

export default function MapScreen() {
  const { webViewRef, headerHeight, setHeaderHeight, headerCovered, headerFade, sheetHeaderCtx, reportsResource, reports, refetchReports, menuFilter, buildings, exhibitions, mapData, mapDataStatus, reloadMapData, filters, layer, facilityKind, selectedAffiliation, selectedCategory, selectedBuilding, selectedPartner, selectedReport, selectedFacilityBuilding, handleRecenter, reportComposer, reportTarget, preview, search, infoSuggest, facilityNav, picker, pickingLocation, route, fromBuilding, toBuilding, fromMyLocation, routeAlternatives, selectedRouteIndex, showRoute, routeTarget, searchQuery, setSearchQuery, selectedBuildingFacilities, selectedFacilityItems, highlightedFacilityId, facilitySheetBuilding, routeNext, handleSetFrom, handleSetTo, handleFacilitySetFrom, handleFacilitySetTo, reportSheetBuilding, handleReportSetFrom, handleReportSetTo, handleCloseBuilding, handleClosePartner, handleCloseReportSheet, nearbyDebug, mapHTML, offscreenPartners, unresolvedCount, mapAuthFailed, dismissMapAuthError, dismissedNotices, dismissNotice, offscreenCount, insets, sideGutter, bottomInset, sheetBottom, mapMenuStyle, mapMenuMaxItemsHeight, handleWebViewMessage, myLocation, handleSelectFacilityKind, handleSelectLayer, resyncMap, handleCancelReportPicker, handlePickRouteDestinationOnMap, handleConfirmReportPicker, handleSwapRoute, handleClearRoute, handleSelectRouteBuilding, handleRouteEndpointPress, handleRouteStripHeight, canShowMyLocationButton, handleSelectHotReport, handleShowOffscreenPartners, handleSelectMyLocationPress, handleChangeRouteTarget, routeFromLabel, routeToLabel, handleCloseRoute, showSearchAndChips, showRouteStrip, showRouteResultCard, showMapMenu, showOverlayNotices, showReportsLoadingNotice, showReportsError, showHotReportList, showNearbyOverlayNote } = useMapScreen()


  const floorDialSheet = (
    <FloorDialSheet
      building={route.floorDial?.building ?? null}
      role={route.floorDial?.role ?? "출발"}
      initialFloor={route.floorDialInitial}
      onCancel={route.cancelFloorDial}
      onConfirm={route.confirmFloorDial}
    />
  );

  return (
    <View style={styles.container}>
      <PartnerNoticeModal />
      {/* 업데이트 후 '제휴 업체'를 처음 누르면 근처 제휴 알림을 한 번 소개한다(11-12). */}
      <NearbyFilterIntro active={layer === "제휴업체"} />
      <LaunchNoticeModal />

      <View style={styles.mapArea}>
        {/* [지도] 탭 바가 지도 위에 떠 있는 캡슐이라(FloatingTabBar) 지도는 화면 맨 아래까지 깐다. 캡슐은 가운데에 떠 있어
            지도 아래 양 끝의 NAVER 로고·저작권 표시는 가리지 않는다(네이버 지도 API 약관). */}
        <View style={styles.mapCanvas}>
          <NaverMapView
            ref={webViewRef}
            html={mapHTML}
            onMessage={handleWebViewMessage}
            onReady={resyncMap}
          />
        </View>

        {/* [지도 위 안내 줄] 검색바·칩 아래에 쌓인다. */}
        <MapNoticeStack top={headerHeight + 8} side={sideGutter}>
          {!mapData && <MapDataStatusNotice failed={mapDataStatus === "error"} onRetry={reloadMapData} />}

          {mapAuthFailed && <MapAuthErrorNotice onDismiss={dismissMapAuthError} />}

          {showReportsLoadingNotice && <ReportsLoadingNotice />}

          {showReportsError && (
            <RetryableError
              variant="chip"
              message={
                reportsResource.data !== undefined
                  ? "제보를 새로 불러오지 못했어요. 마지막으로 받은 제보를 보여주고 있어요."
                  : (reportsResource.errorMessage ?? "")
              }
              isNetworkError={reportsResource.isNetworkError}
              onRetry={reportsResource.canRetry ? reportsResource.retry : undefined}
              retrying={reportsResource.loading || reportsResource.refreshing}
              onDismiss={reportsResource.clearError}
            />
          )}

          {showHotReportList && (
            <HotReportList reports={reports} selectedId={null} onSelect={handleSelectHotReport} />
          )}

          {showOverlayNotices && preview.askCard && (
            <AskPlaceCard title={preview.askCard.title} summary={preview.askCard.summary} onBack={preview.backToAsk} onClose={preview.closeAskCard} />
          )}

          {showOverlayNotices && preview.previewTarget && (
            <ReviewPinNotice label={preview.previewTarget.label} detail={preview.previewTarget.detail} onClose={preview.clearPreview} />
          )}

          {showOverlayNotices && unresolvedCount > 0 && (
            <DismissibleNotice
              message={`건물을 찾지 못한 편의시설 ${unresolvedCount}곳은 지도에서 빠졌어요`}
              dismissed={dismissedNotices}
              onDismiss={dismissNotice}
            />
          )}

          {showOverlayNotices && offscreenCount > 0 && (
            <DismissibleNotice
              message={`지도에 안 보이는 ${offscreenCount}곳 · ${offscreenSummary(offscreenPartners)}`}
              actionLabel="보기"
              onPress={handleShowOffscreenPartners}
              dismissed={dismissedNotices}
              onDismiss={dismissNotice}
            />
          )}
        </MapNoticeStack>

        {/* [근처 알림 개발 도구] 테스트 위치 고르기·영역 보기 안내 */}
        {nearbyDebug.picking && (
          <NearbyTestPicker
            bottom={16 + bottomInset}
            onConfirm={nearbyDebug.requestCenter}
            onUseRealLocation={nearbyDebug.resetToRealLocation}
            onCancel={nearbyDebug.cancelPicking}
          />
        )}
        {showNearbyOverlayNote && nearbyDebug.note && (
          <NearbyOverlayNote
            note={nearbyDebug.note}
            testLabel={nearbyDebug.label}
            unregistered={nearbyDebug.unregistered}
            bottom={84 + bottomInset}
          />
        )}
        {/* [지도 메뉴] 오른쪽 아래(제보 보기·내 위치·캠퍼스로·길찾기·제보하기) */}
        {showMapMenu && (
          <MapActionMenu
            style={mapMenuStyle}
            onReport={reportComposer.handleStartPicker}
            onRoute={ROUTE_FINDING_ENABLED ? route.openSearch : undefined}
            onRecenter={handleRecenter}
            onMyLocation={canShowMyLocationButton ? myLocation.toggle : undefined}
            myLocationOn={myLocation.on}
            onToggleNearbyOverlay={nearbyDebug.menuAvailable ? nearbyDebug.toggleOverlay : undefined}
            onPickNearbyTestLocation={nearbyDebug.menuAvailable ? nearbyDebug.startPicking : undefined}
            nearbyOverlayOn={nearbyDebug.overlayOn}
            maxItemsHeight={mapMenuMaxItemsHeight}
            reportFilter={menuFilter}
          />
        )}

        {/* [위치 고르기] 제보·정보 제보·길찾기 도착을 지도 가운데 핀으로 */}
        {pickingLocation && (
          <LocationPickerOverlay
            purpose={picker.purpose}
            center={picker.center}
            routeBuildingName={picker.routeTarget?.name ?? null}
            top={headerHeight + 8}
            bottom={20 + bottomInset}
            side={sideGutter}
            onCancel={handleCancelReportPicker}
            onConfirm={handleConfirmReportPicker}
          />
        )}

        {/* [길찾기] 위 출발·도착 막대, 아래 결과 카드 */}
        {showRouteStrip && (
          <RouteStrip
            fromLabel={routeFromLabel}
            toLabel={routeToLabel}
            fromIsBuilding={fromBuilding !== null}
            toIsBuilding={toBuilding !== null}
            canSwap={fromBuilding !== null && toBuilding !== null && !fromMyLocation}
            onPressEndpoint={handleRouteEndpointPress}
            onSearch={route.openSearch}
            onSwap={handleSwapRoute}
            onClose={handleClearRoute}
            top={headerHeight + 8}
            side={sideGutter}
            onHeight={handleRouteStripHeight}
          />
        )}

        {showRouteResultCard && (
          <RouteResultCard
            routes={routeAlternatives}
            selectedIndex={selectedRouteIndex}
            onSelect={route.selectAlternative}
            onClose={handleClearRoute}
            bottom={8 + bottomInset}
            side={sideGutter}
            onHeight={route.setCardHeight}
          />
        )}

        {/* [아래 시트] 고른 건물·제휴·시설·제보 */}
        <MapSheets headerContext={sheetHeaderCtx} bottom={sheetBottom} side={sideGutter}>
          {selectedBuilding && (
            <BuildingSheet
              key={selectedBuilding.name}
              building={selectedBuilding}
              facilities={selectedBuildingFacilities}
              onOpenFacility={facilityNav.openFromBuilding}
              onClose={handleCloseBuilding}
              routeFindingEnabled={ROUTE_FINDING_ENABLED}
              onSetFrom={handleSetFrom}
              onSetTo={handleSetTo}
              routeNext={routeNext}
            />
          )}

          {selectedPartner && (
            <PartnerSheet
              key={selectedPartner.id}
              partner={selectedPartner}
              onClose={handleClosePartner}
              onSuggestEdit={infoSuggest.suggestPartnerEdit}
            />
          )}

          {selectedFacilityBuilding && facilityKind && (
            <FacilitySheet
              key={`${facilityKind}:${selectedFacilityBuilding}`}
              kind={facilityKind}
              buildingName={selectedFacilityBuilding}
              items={selectedFacilityItems}
              exhibitions={exhibitions}
              highlightId={highlightedFacilityId}
              onClose={facilityNav.closeSheet}
              onBack={facilityNav.facilityFrom ? facilityNav.backToBuilding : undefined}
              backLabel={facilityNav.facilityFrom ? `${withRo(facilityNav.facilityFrom.building.name)} 돌아가기` : undefined}
              onSetFrom={ROUTE_FINDING_ENABLED && facilitySheetBuilding ? handleFacilitySetFrom : undefined}
              onSetTo={ROUTE_FINDING_ENABLED && facilitySheetBuilding ? handleFacilitySetTo : undefined}
              routeNext={routeNext}
            />
          )}

          {selectedReport && (
            // 제보마다 새로 그린다. 시트 안의 🔥·관심·신고 요청 중 상태와 늦게 온 응답·오류·메뉴가 다른 제보로
            // 넘어가지 않게(예전엔 마커만 바꿔 누르면 앞 제보의 응답이 뒤 제보 시트에 덮였다).
            <ReportSheet
              key={selectedReport.id}
              report={selectedReport}
              onClose={handleCloseReportSheet}
              onChanged={refetchReports}
              routeBuildingName={ROUTE_FINDING_ENABLED ? (reportSheetBuilding?.name ?? null) : null}
              onSetFrom={ROUTE_FINDING_ENABLED && reportSheetBuilding ? handleReportSetFrom : undefined}
              onSetTo={ROUTE_FINDING_ENABLED && reportSheetBuilding ? handleReportSetTo : undefined}
              routeNext={routeNext}
            />
          )}
        </MapSheets>
      </View>

      {/* [위 막대] 검색바·칩. mapArea 뒤에 와야(later sibling) 지도 위에 그려진다. 빈 곳 터치는 지도로 간다. */}
      <MapTopBar topInset={insets.top} opacity={headerFade} covered={headerCovered} onHeight={setHeaderHeight}>
        {showSearchAndChips && (
          <>
            <MapSearchBar sideGutter={sideGutter} onPress={search.open} />
            <FilterChipSection sideGutter={sideGutter}>
              <MapFilterChips
                layer={layer}
                facilityKind={facilityKind}
                onSelectLayer={handleSelectLayer}
                onSelectFacilityKind={handleSelectFacilityKind}
              />
              {layer === "제휴업체" && (
                <PartnerChips
                  affiliation={selectedAffiliation}
                  category={selectedCategory}
                  onSelectAffiliation={filters.selectAffiliation}
                  onSelectCategory={filters.selectCategory}
                />
              )}
            </FilterChipSection>
          </>
        )}
      </MapTopBar>

      {/* [창] 층 다이얼·길찾기 창·검색 창·제보 쓰기·정보 제보 */}
      {!showRoute && floorDialSheet}
      <RoutePlannerModal
        visible={showRoute}
        onClose={handleCloseRoute}
        overlay={showRoute ? floorDialSheet : null}
        target={routeTarget}
        fromLabel={routeFromLabel}
        toLabel={routeToLabel}
        onChangeTarget={handleChangeRouteTarget}
        query={searchQuery}
        onChangeQuery={setSearchQuery}
        buildings={buildings}
        onSelectBuilding={handleSelectRouteBuilding}
        onPickDestinationOnMap={handlePickRouteDestinationOnMap}
        onSelectMyLocation={canLocate() ? handleSelectMyLocationPress : undefined}
      />

      <PartnerSearchModal
        visible={search.visible}
        topInset={insets.top}
        onClose={search.close}
        onSelect={search.selectPartner}
        onSelectFacility={facilityNav.openFacility}
        autoFocus={!search.nearbyGroup}
        pinned={search.pinnedSection}
      />

      <ReportComposerModal
        target={reportTarget}
        onClose={reportComposer.close}
        onCreated={reportComposer.handleCreated}
      />

      <InfoSuggestModal
        visible={infoSuggest.visible}
        location={infoSuggest.state?.location ?? null}
        prefill={infoSuggest.state?.prefill ?? null}
        onClose={infoSuggest.close}
        onPickOnMap={infoSuggest.pickOnMap}
      />
    </View>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  // 검색바 좌우에 지도가 비치는 여백이 남지 않도록, 알약 모양은 이 흰
  // 배경 안쪽 padding 으로만 띄운다(margin 이면 그 여백엔 배경이 없다).
  // 흰 배경을 깔지 않는다 — 검색바 알약 자체(아래 searchBar)만 흰색이고,
  mapArea: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  // 실제 지도가 그려지는 칸. 탭바가 떠 있는 캡슐이라 화면 전체를 덮는다(JSX 주석 참고).
  // 위치 고르기 중앙 핀(pickerMarkerWrap)도 같은 칸 전체 기준이어야 map.getCenter() 와 겹친다.
  mapCanvas: { flex: 1 },
  // 건물·제휴업체·제보 배너를 얹는 레이어. 얘 자체엔 위치가 없고(화면 전체를 덮기만),
  // 필터 칩 줄과 같은 왼쪽 여백(16)에 맞춘다. 넓은 화면에서 가운데로 몰려 칩과 어긋나지 않게 하고, 너무 넓어지지 않게 폭만 묶는다.
  /** 출발: 남색 테두리 빈 원, 도착: 남색 채운 원(지도 표시와 같음). */
});
