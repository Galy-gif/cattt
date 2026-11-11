import SwiftUI

struct MailboxLettersView: View {
    @EnvironmentObject private var store: AppStore
    @State private var expanded: Set<String> = []

    var body: some View {
        if store.backend.isRemote {
            VStack(alignment: .leading, spacing: 12) {
                SectionTitle(text: "团子留的信")
                if let error = store.inboxError {
                    Button(error) { store.refreshInbox() }.font(Typo.sans(13)).foregroundStyle(Palette.ink3)
                } else if store.mailboxLetters.isEmpty {
                    Text("信箱里还没有新的信").font(Typo.sans(13)).foregroundStyle(Palette.ink3)
                }
                ForEach(store.mailboxLetters) { letter in
                    Button {
                        if expanded.contains(letter.id) { expanded.remove(letter.id) }
                        else { expanded.insert(letter.id); store.readLetter(letter) }
                    } label: {
                        VStack(alignment: .leading, spacing: 10) {
                            HStack {
                                Text(letter.readAt == nil ? "一封新信" : "团子留的信").font(Typo.sans(12)).foregroundStyle(Palette.ink3)
                                Spacer()
                                if let date = APITicket.parseDate(letter.createdAt) {
                                    Text(date.formatted(date: .abbreviated, time: .omitted)).font(Typo.sans(12)).foregroundStyle(Palette.ink3)
                                }
                            }
                            Text(letter.text).font(Typo.serif(16)).lineSpacing(8)
                                .foregroundStyle(Palette.paperInk)
                                .lineLimit(expanded.contains(letter.id) ? nil : 2)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                        .padding(18)
                        .background(Palette.paper, in: RoundedRectangle(cornerRadius: Metrics.radiusCard))
                    }.buttonStyle(.plain)
                }
            }.padding(.bottom, 16)
        }
    }
}
