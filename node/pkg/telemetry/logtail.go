package telemetry

import (
	"bytes"
	"context"
	"fmt"
	"go.uber.org/zap"
	"go.uber.org/zap/buffer"
	"go.uber.org/zap/zapcore"
	"io/ioutil"
	"net/http"
	"time"
)

const logtailIngest = "https://in.logtail.com"

type Service struct {
	encoder      *encoder
	batchSize    int
	logtailToken string
}

type encoder struct {
	zapcore.Encoder
	queue  chan []byte
	client *http.Client
}

func (enc *encoder) EncodeEntry(entry zapcore.Entry, fields []zapcore.Field) (*buffer.Buffer, error) {
	buf, err := enc.Encoder.EncodeEntry(entry, fields)
	if err != nil {
		return nil, err
	}

	// Create a copy of buf (zap will reuse the same buffer)
	bufCopy := make([]byte, len(buf.Bytes()))
	copy(bufCopy, buf.Bytes())

	select {
	case enc.queue <- bufCopy:
	default:
		// We drop the message if the queue is full.
		fmt.Println("telemetry queue overflow")
	}

	return buf, nil
}

func NewTelemetryService(bufferSize int, batchSize int, logtailToken string) *Service {
	return &Service{
		batchSize:    batchSize,
		logtailToken: logtailToken,
		encoder: &encoder{
			Encoder: zapcore.NewJSONEncoder(zap.NewProductionEncoderConfig()),
			queue:   make(chan []byte, bufferSize),
			client:  &http.Client{Timeout: 5 * time.Second}, // TODO: make configurable
		},
	}
}

func (s *Service) Run(ctx context.Context) error {
	// Read from queue, batchSize messages at the time.
	// Send to the server.
	for {
		batch := make([][]byte, 0, s.batchSize)
		for i := 0; i < s.batchSize; i++ {
			select {
			case buf := <-s.encoder.queue:
				batch = append(batch, buf)
			case <-time.After(1 * time.Second):
				fmt.Println("telemetry queue timeout")
				break
			case <-ctx.Done():
				return nil
			}
		}

		if len(batch) == 0 {
			panic("batch is empty")
		}

		err := s.sendBatch(ctx, batch)
		if err != nil {
			fmt.Printf("failed to send batch: %v\n", err)

			// Retry once
			go func() {
				time.Sleep(1 * time.Second)
				err := s.sendBatch(ctx, batch)
				if err != nil {
					fmt.Printf("failed to send batch (retry): %v\n", err)
				}
			}()
		}
	}
}

func (s *Service) sendBatch(ctx context.Context, batch [][]byte) error {
	buf := bytes.NewBuffer(nil)
	buf.Write([]byte("["))
	for i, b := range batch {
		if i > 0 {
			buf.Write([]byte(","))
		}
		buf.Write(b)
	}
	buf.Write([]byte("]"))

	req, err := http.NewRequestWithContext(ctx, "POST", logtailIngest, buf)
	if err != nil {
		panic(err)
	}

	req.Header.Add("Authorization", "Bearer "+s.logtailToken)
	req.Header.Add("Content-Type", "application/json")

	resp, err := s.encoder.client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send logtail request: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusAccepted {
		return fmt.Errorf("failed to send logtail request: %v", resp.Status)
	}

	return nil
}

func (s *Service) WrapLogger(logger *zap.Logger) *zap.Logger {
	tc := zapcore.NewCore(
		s.encoder,
		zapcore.AddSync(ioutil.Discard),
		zap.DebugLevel,
	)

	return logger.WithOptions(zap.WrapCore(func(core zapcore.Core) zapcore.Core {
		return zapcore.NewTee(core, tc)
	}))
}
