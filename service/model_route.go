package service

import (
	"errors"
	"math/rand"
	"strings"

	"github.com/basketikun/infinite-canvas/model"
	"github.com/basketikun/infinite-canvas/repository"
)

type ModelRoute struct {
	Channel model.ModelChannel
	Credits int
}

func ResolveModelRoute(modelName string) (ModelRoute, error) {
	settings, err := repository.GetSettings()
	if err != nil {
		return ModelRoute{}, err
	}
	channel, err := selectModelChannelFromSettings(settings, modelName)
	if err != nil {
		return ModelRoute{}, err
	}
	return ModelRoute{Channel: channel, Credits: modelCostFromSettings(settings, modelName)}, nil
}

func modelCostFromSettings(settings model.Settings, modelName string) int {
	modelName = strings.TrimSpace(modelName)
	for _, item := range normalizePublicSetting(settings.Public).ModelChannel.ModelCosts {
		if item.Model == modelName {
			return item.Credits
		}
	}
	return 0
}

func selectModelChannelFromSettings(settings model.Settings, modelName string) (model.ModelChannel, error) {
	channels := modelChannelsForModel(normalizePrivateSetting(settings.Private).Channels, modelName)
	return selectWeightedModelChannel(channels)
}

func selectWeightedModelChannel(channels []model.ModelChannel) (model.ModelChannel, error) {
	if len(channels) == 0 {
		return model.ModelChannel{}, errors.New("没有可用模型渠道")
	}
	total := 0
	for _, channel := range channels {
		total += channel.Weight
	}
	hit := rand.Intn(total)
	for _, channel := range channels {
		hit -= channel.Weight
		if hit < 0 {
			return channel, nil
		}
	}
	return channels[0], nil
}
