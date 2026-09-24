# Task 9: Multi-Supplier Strategy & Deduplication Engine

## Problem Statement
When querying multiple travel inventory suppliers (e.g., Supplier A / TBO and Supplier B / TripJack), both suppliers may return the exact same underlying airline flight (e.g., Air India `AI101` from AMD to DEL departing at 14:00):
- **Supplier A**: INR 8,450
- **Supplier B**: INR 8,150

Presenting duplicate rows for the identical flight clutters the customer search experience. Tixxgo must:
1. Deterministically identify duplicate itineraries.
2. Select the optimal offer using an intelligent multi-factor decision engine.
3. Preserve alternative supplier offers for transparent operational auditing and fallback booking.

---

## 1. Itinerary Fingerprinting & Deduplication Algorithm
A flight itinerary is deduplicated using a canonical signature that strips supplier-specific identifiers:

```
Signature = AirlineCode + "_" + FlightNumber + "_" + OriginAirport + "_" + DestinationAirport + "_" + DepartureTimestamp(MinuteResolution)
```

**Example:**
- Both TBO and TripJack return Air India flight 101 on 15 Oct 2026 departing at 14:00.
- Normalized Signature: `AI_AI101_AMD_DEL_2026-10-15T14:00`
- The system groups both offers under this signature key.

---

## 2. Multi-Factor Offer Scoring Model
Rather than simply choosing the cheapest raw fare, Tixxgo computes a composite **Offer Quality & Commercial Score (0 - 100)**:

$$\text{Composite Score} = W_{\text{price}} \cdot S_{\text{price}} + W_{\text{margin}} \cdot S_{\text{margin}} + W_{\text{reliability}} \cdot S_{\text{reliability}} + W_{\text{baggage}} \cdot S_{\text{baggage}} + W_{\text{flexibility}} \cdot S_{\text{flexibility}}$$

### Weightings and Criteria Breakdown:

| Factor | Weight | Evaluation Criteria | Rationale |
| :--- | :---: | :--- | :--- |
| **Customer Price** | **35%** | Lower customer selling price | Maximizes checkout conversion rate. |
| **Commercial Margin** | **20%** | Commission rate / net revenue earned by Tixxgo | Balances top-line discount with platform profitability. |
| **Supplier Reliability & SLA** | **20%** | Historical booking success rate (e.g. 98.5% vs 96.2%) | Prevents high-cost post-payment failures and customer churn. |
| **Baggage Allowance** | **15%** | Included check-in luggage (e.g. 20 KG vs 15 KG) | Significant customer value-add that justifies price differentials. |
| **Refundability & Flexibility**| **10%** | Refundable vs Non-refundable, change fee tiers | Value for business and flexible travelers. |

---

## 3. Real-world Evaluation of the AI101 Scenario

Let us evaluate the real parameters from the TBO vs TripJack scenario:

| Dimension | Supplier A (TBO) | Supplier B (TripJack) | Winner / Analysis |
| :--- | :--- | :--- | :--- |
| **Supplier Cost** | INR 8,450 | **INR 8,150** | **TripJack** (cheaper by INR 300) |
| **Commission Rate** | 3.0% (INR 253.50) | **4.5%** (INR 366.75) | **TripJack** (+INR 113.25 more profit) |
| **Check-in Baggage** | 15 KG | **20 KG** | **TripJack** (+5 KG allowance) |
| **Refundability** | Refundable | Refundable | Tied |
| **Historical SLA** | **98.5%** | 96.2% | **TBO** (higher confirmation rate) |
| **Composite Score** | **78.4 / 100** | **88.6 / 100** | **TripJack Selected** |

### Decision:
TripJack is selected as the primary offer because it delivers a lower price to the customer, higher baggage allowance, and a higher commercial commission margin for Tixxgo, easily surpassing TBO despite TBO's slight SLA advantage.

---

## 4. Cascading Fallback Routing (Zero Dropouts)
In production, if the customer selects the TripJack offer, but TripJack's inventory revalidation fails at checkout (e.g. fare class sells out):
1. The platform automatically triggers a **graceful fallback** to Supplier A (TBO).
2. The customer is presented with a prompt: *"The 20KG fare bucket just closed; would you like to secure the remaining seat with 15KG baggage via our partner network for INR 8,450?"*
3. The booking is preserved without bouncing the user back to the home page.
