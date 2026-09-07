# Connect Frontend ↔ Backend: Full Integration

The frontend and backend are built separately and have significant **data shape mismatches** — the frontend expects fields/endpoints that don't exist in the backend, and the backend returns different field names than the frontend consumes. This plan fixes every integration gap so the app works end-to-end.

## Summary of Issues Found

| Area | Frontend expects | Backend provides | Fix |
|---|---|---|---|
| **Lots list** | `title`, `produce`, `quantity`, `unit`, `price_per_unit`, `farmer`, `farmer_name` | `commodity`, `quantity_kg`, `asking_price_per_kg`, `farmer_id` | Add backend response schemas that map fields, or adapt frontend |
| **Farmer lots** | `GET /lots/mine` | ❌ Doesn't exist | Add `GET /lots/mine` endpoint |
| **Create lot** | `title`, `produce`, `unit`, `location`, `description`, `harvest_date` | `commodity`, `variety`, `quantity_kg`, `quality_grade`, `asking_price_per_kg`, `district`, `state` | Align create form to backend fields |
| **Farmer offers** | `GET /offers/received` → grouped `{lot, offers: [{buyer, price}]}` | `GET /offers/received` → flat list of `OfferResponse` (no buyer info, no lot info) | Add enriched endpoint or modify response |
| **Buyer offers** | `GET /offers/sent` → `SentOffer` with `lot` and `farmer` objects | `GET /offers/sent` → flat `OfferResponse` (no lot details, no farmer info) | Add enriched response |
| **Transactions** | `quantity`, `unit`, `total_amount`, `lot`, `farmer`, `buyer` objects | Only `offer_id`, `final_price_per_kg`, `payment_status` | Enrich transaction response |
| **Prices page** | Recharts line chart, forecast endpoint | Backend `/prices` and `/forecast` exist ✅ — shapes need minor check |
| **Navbar** | Links to `/price-dashboard` | Prices page is at `/prices` | Fix link |
| **Register** | Calls `register()` then redirects to login | Backend returns token on register — should auto-login | Fix register flow |

## Proposed Changes

### Backend — New endpoint & enriched responses

#### [MODIFY] [lots.py](file:///c:/Users/syeds/sih-ps26132-krishimarket/backend/app/routers/lots.py)
- Add `GET /lots/mine` endpoint (returns farmer's own lots, requires auth)
- Enrich `LotResponse` with `farmer_name` field
- Map fields: `quantity_kg` → `quantity`, `asking_price_per_kg` → keep as-is (frontend adapts)

#### [MODIFY] [offers.py](file:///c:/Users/syeds/sih-ps26132-krishimarket/backend/app/routers/offers.py)
- Modify `GET /offers/received` to return grouped response: `{lot: {...}, offers: [{..., buyer: {...}}]}`
- Modify `GET /offers/sent` to include `lot` details and `farmer` info in each offer
- Add `buyer_name`, `buyer_email`, `buyer_phone` fields to offer responses

#### [MODIFY] [transactions.py](file:///c:/Users/syeds/sih-ps26132-krishimarket/backend/app/routers/transactions.py)
- Enrich response with `lot_title`, `quantity`, `unit`, `total_amount`, `farmer`, `buyer` objects

---

### Frontend — Adapt to actual backend data shapes

#### [MODIFY] [market-types.ts](file:///c:/Users/syeds/sih-ps26132-krishimarket/frontend/lib/market-types.ts)
- Update `Lot` interface to match backend fields (`quantity_kg`, `asking_price_per_kg`, `commodity`)
- Update `Transaction` to match enriched backend response
- Fix `PaymentStatus` — backend uses `"delivered"`, not `"failed"`

#### [MODIFY] [auth-context.tsx](file:///c:/Users/syeds/sih-ps26132-krishimarket/frontend/lib/auth-context.tsx)
- Fix `register()` to auto-login (backend returns token on register)

#### [MODIFY] [lots page.tsx](file:///c:/Users/syeds/sih-ps26132-krishimarket/frontend/app/lots/page.tsx)
- Adapt lot card rendering to use backend field names

#### [MODIFY] [lot detail page.tsx](file:///c:/Users/syeds/sih-ps26132-krishimarket/frontend/app/lots/%5Bid%5D/page.tsx)
- Adapt to backend field names

#### [MODIFY] [farmer lots page.tsx](file:///c:/Users/syeds/sih-ps26132-krishimarket/frontend/app/farmer/lots/page.tsx)
- Fix create lot form to send backend-compatible fields (`commodity`, `quantity_kg`, `asking_price_per_kg`, `district`, `state`, `quality_grade`, `variety`)
- Adapt lot card rendering

#### [MODIFY] [farmer offers page.tsx](file:///c:/Users/syeds/sih-ps26132-krishimarket/frontend/app/farmer/offers/page.tsx)
- Adapt to new enriched backend response shape

#### [MODIFY] [buyer offers page.tsx](file:///c:/Users/syeds/sih-ps26132-krishimarket/frontend/app/buyer/offers/page.tsx)
- Adapt to enriched backend response

#### [MODIFY] [transactions page.tsx](file:///c:/Users/syeds/sih-ps26132-krishimarket/frontend/app/transactions/page.tsx)
- Adapt to enriched backend response
- Fix `PaymentStatus` filter (`delivered` instead of `failed`)

#### [MODIFY] [navbar.tsx](file:///c:/Users/syeds/sih-ps26132-krishimarket/frontend/components/navbar.tsx)
- Fix `/price-dashboard` link → `/prices`

#### [MODIFY] [register page.tsx](file:///c:/Users/syeds/sih-ps26132-krishimarket/frontend/app/register/page.tsx)
- Auto-login after successful registration

## Verification Plan

### Manual Verification
1. Start backend: `cd backend && uvicorn main:app --reload`
2. Start frontend: `cd frontend && npm run dev`
3. Test full flow:
   - Register farmer → auto-login → create lot → verify lot appears
   - Register buyer → browse lots → make offer → verify offer appears
   - Farmer accepts offer → transaction created
   - Buyer marks payment → status updates
   - Price dashboard loads with data
