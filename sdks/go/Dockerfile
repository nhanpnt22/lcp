FROM golang:1.25 AS builder
WORKDIR /src

COPY third_party ./third_party
COPY lcp/sdks/go ./lcp/sdks/go

WORKDIR /src/lcp/sdks/go
RUN go mod download
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /out/seed_cache ./cmd/seed_cache

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=builder /out/seed_cache /seed_cache
ENTRYPOINT ["/seed_cache"]
