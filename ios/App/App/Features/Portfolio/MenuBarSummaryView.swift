import SwiftUI

#if os(macOS)
struct MenuBarSummaryView: View {
    @EnvironmentObject private var environment: AppEnvironment
    @State private var portfolio: PortfolioResponse?
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if let portfolio {
                let totals = portfolio.totals
                
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Patrimonio Total")
                            .font(.caption)
                            .foregroundStyle(SiloxColors.textSecondary)
                        Text(SiloxFormatters.money(totals.totalValue.amount, currency: totals.totalValue.currency))
                            .font(.title2.weight(.bold))
                    }
                    Spacer()
                    if let market = portfolio.marketState, market.isOpen {
                        HStack(spacing: 4) {
                            Circle().fill(SiloxColors.accentSecondary).frame(width: 6, height: 6)
                            Text("En directo")
                                .font(.caption2.weight(.semibold))
                                .foregroundStyle(SiloxColors.accentSecondary)
                        }
                    }
                }
                
                Divider()
                
                HStack(spacing: 20) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Hoy")
                            .font(.caption2)
                            .foregroundStyle(SiloxColors.textSecondary)
                        if let gain = totals.dailyGain {
                            let isPositive = gain.amount.decimalValue >= 0
                            Text(SiloxFormatters.signedMoney(gain.amount, currency: gain.currency))
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(isPositive ? SiloxColors.positive : SiloxColors.negative)
                        } else {
                            Text("—").font(.subheadline.weight(.semibold))
                        }
                    }
                    
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Histórico")
                            .font(.caption2)
                            .foregroundStyle(SiloxColors.textSecondary)
                        let gain = totals.totalGain
                        let isPositive = gain.amount.decimalValue >= 0
                        Text(SiloxFormatters.signedMoney(gain.amount, currency: gain.currency))
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(isPositive ? SiloxColors.positive : SiloxColors.negative)
                    }
                }
                
            } else {
                ProgressView()
                    .frame(maxWidth: .infinity, alignment: .center)
            }
        }
        .padding(16)
        .frame(width: 260)
        .task {
            portfolio = await environment.portfolioRepository.cached()?.value
            if portfolio == nil {
                portfolio = try? await environment.portfolioRepository.refresh()
            }
        }
    }
}
#endif
