#!/usr/bin/env python3
"""
GEOTECHNICAL COST ASSESSMENT MODULE v1.0

Purpose: Systematically assess geotechnical cost impacts based on location and building type
Status: PRODUCTION - Phase 1
Created: 2026-02-08

Usage:
    from geotechnical_cost_assessment import GeotechnicalAssessment
    
    assessment = GeotechnicalAssessment()
    result = assessment.assess(
        region="CA_INLAND",
        building_type="commercial_office",
        stage="BIDDING"
    )
    print(result)
"""

import yaml
import json
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass
from enum import Enum

# ============================================================================
# DATA STRUCTURES
# ============================================================================

class Stage(Enum):
    """Project stage affecting geotechnical cost estimation"""
    BIDDING = "BIDDING"
    POST_AWARD = "POST_AWARD"
    FINAL = "FINAL"

class BuildingType(Enum):
    """Building types with different geotechnical sensitivities"""
    WAREHOUSE = "warehouse"
    COMMERCIAL_OFFICE = "commercial_office"
    HEALTHCARE = "healthcare"

@dataclass
class GeotechnicalCostResult:
    """Result of geotechnical cost assessment"""
    region: str
    building_type: str
    stage: str
    base_adjustment: float
    risk_premium: float
    total_adjustment: float
    building_type_multiplier: float
    final_adjustment: float
    confidence: str
    breakdown: Dict
    recommendations: Dict
    notes: str

# ============================================================================
# GEOTECHNICAL ASSESSMENT ENGINE
# ============================================================================

class GeotechnicalAssessment:
    """
    Main assessment engine for geotechnical cost impacts
    """
    
    def __init__(self, matrix_file: str = "/home/ubuntu/GEOTECHNICAL_COST_DRIVER_MATRIX_v1.0.yaml"):
        """
        Initialize assessment engine with matrix data
        
        Args:
            matrix_file: Path to YAML matrix file
        """
        self.matrix_file = matrix_file
        self.matrix = self._load_matrix()
        self.regions = self.matrix.get('regions', {})
        self.building_type_adjustments = self.matrix.get('building_type_adjustments', {})
    
    def _load_matrix(self) -> Dict:
        """Load geotechnical matrix from YAML file"""
        try:
            with open(self.matrix_file, 'r') as f:
                return yaml.safe_load(f)
        except FileNotFoundError:
            print(f"Warning: Matrix file not found at {self.matrix_file}")
            return {}
    
    def assess(
        self,
        region: str,
        building_type: str = "commercial_office",
        stage: str = "BIDDING",
        hard_cost: Optional[float] = None
    ) -> GeotechnicalCostResult:
        """
        Assess geotechnical cost impact for a project
        
        Args:
            region: Region ID (e.g., "CA_INLAND", "TX_COASTAL")
            building_type: Building type (warehouse, commercial_office, healthcare)
            stage: Project stage (BIDDING, POST_AWARD, FINAL)
            hard_cost: Hard cost for calculating dollar impact (optional)
        
        Returns:
            GeotechnicalCostResult with detailed breakdown
        """
        
        # Validate inputs
        if region not in self.regions:
            raise ValueError(f"Region '{region}' not found in matrix. Available: {list(self.regions.keys())}")
        
        if building_type not in self.building_type_adjustments:
            raise ValueError(f"Building type '{building_type}' not found. Available: {list(self.building_type_adjustments.keys())}")
        
        # Get region data
        region_data = self.regions[region]
        
        # Get stage-specific recommendations
        stage_key = stage.lower() if isinstance(stage, str) else stage.value.lower()
        # Convert stage names to recommendation keys
        stage_key_map = {
            'bidding': 'bidding_stage',
            'post_award': 'post_award_stage',
            'final': 'final_stage'
        }
        rec_key = stage_key_map.get(stage_key, stage_key)
        if rec_key not in region_data['recommendations']:
            raise ValueError(f"Stage '{stage}' not found in recommendations. Available: {list(region_data['recommendations'].keys())}")
        
        recommendations = region_data['recommendations'][rec_key]
        
        # Get building type adjustment
        bt_data = self.building_type_adjustments[building_type]
        bt_multiplier = bt_data['adjustment_multiplier']
        
        # Calculate adjustments
        base_adjustment = recommendations['base_adjustment']
        risk_premium = recommendations['risk_premium']
        total_adjustment = recommendations['total']
        
        # Apply building type multiplier
        final_adjustment = base_adjustment * bt_multiplier + risk_premium
        
        # Build breakdown
        breakdown = self._build_breakdown(region_data)
        
        # Calculate dollar impact if hard cost provided
        cost_impact = None
        if hard_cost:
            cost_impact = hard_cost * final_adjustment
        
        result = GeotechnicalCostResult(
            region=region,
            building_type=building_type,
            stage=stage,
            base_adjustment=base_adjustment,
            risk_premium=risk_premium,
            total_adjustment=total_adjustment,
            building_type_multiplier=bt_multiplier,
            final_adjustment=final_adjustment,
            confidence=region_data['summary']['confidence'],
            breakdown=breakdown,
            recommendations=recommendations,
            notes=region_data['summary']['notes']
        )
        
        return result
    
    def _build_breakdown(self, region_data: Dict) -> Dict:
        """Build detailed cost driver breakdown"""
        profile = region_data['geotechnical_profile']
        
        breakdown = {}
        for driver_name, driver_data in profile.items():
            if 'cost_impact' in driver_data:
                breakdown[driver_name] = {
                    'cost_impact': driver_data['cost_impact'],
                    'description': driver_data.get('description', ''),
                    'confidence': driver_data.get('confidence', 'MEDIUM')
                }
        
        return breakdown
    
    def compare_regions(
        self,
        regions: List[str],
        building_type: str = "commercial_office",
        stage: str = "BIDDING"
    ) -> List[Dict]:
        """
        Compare geotechnical costs across multiple regions
        
        Args:
            regions: List of region IDs to compare
            building_type: Building type for comparison
            stage: Project stage
        
        Returns:
            List of assessment results sorted by cost impact
        """
        results = []
        for region in regions:
            try:
                result = self.assess(region, building_type, stage)
                results.append({
                    'region': region,
                    'final_adjustment': result.final_adjustment,
                    'confidence': result.confidence,
                    'notes': result.notes
                })
            except ValueError as e:
                print(f"Error assessing {region}: {e}")
        
        # Sort by final adjustment (highest first)
        results.sort(key=lambda x: x['final_adjustment'], reverse=True)
        return results
    
    def get_historical_data(self, region: str, building_type: str = None) -> Dict:
        """
        Get historical project data for a region
        
        Args:
            region: Region ID
            building_type: Optional building type filter
        
        Returns:
            Historical data including project counts and averages
        """
        if region not in self.regions:
            raise ValueError(f"Region '{region}' not found")
        
        historical = self.regions[region]['historical_data']
        
        if building_type:
            if building_type not in historical['by_building_type']:
                raise ValueError(f"Building type '{building_type}' not found for region")
            return historical['by_building_type'][building_type]
        
        return historical
    
    def estimate_cost_impact(
        self,
        region: str,
        building_type: str,
        hard_cost: float,
        stage: str = "BIDDING"
    ) -> Dict:
        """
        Estimate dollar cost impact of geotechnical factors
        
        Args:
            region: Region ID
            building_type: Building type
            hard_cost: Base hard cost in dollars
            stage: Project stage
        
        Returns:
            Dictionary with cost impact breakdown
        """
        result = self.assess(region, building_type, stage, hard_cost)
        
        cost_impact = hard_cost * result.final_adjustment
        
        return {
            'region': region,
            'building_type': building_type,
            'stage': stage,
            'base_hard_cost': hard_cost,
            'geotechnical_adjustment_percent': result.final_adjustment * 100,
            'geotechnical_cost_impact': cost_impact,
            'total_cost_with_geo': hard_cost + cost_impact,
            'breakdown': result.breakdown,
            'confidence': result.confidence
        }

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

def print_assessment(result: GeotechnicalCostResult, hard_cost: Optional[float] = None) -> None:
    """Pretty print assessment result"""
    print("\n" + "="*80)
    print(f"GEOTECHNICAL COST ASSESSMENT")
    print("="*80)
    print(f"Region:           {result.region}")
    print(f"Building Type:    {result.building_type}")
    print(f"Stage:            {result.stage}")
    print(f"Confidence:       {result.confidence}")
    print("-"*80)
    print(f"Base Adjustment:  {result.base_adjustment:.1%}")
    print(f"Risk Premium:     {result.risk_premium:.1%}")
    print(f"Total Adjustment: {result.total_adjustment:.1%}")
    print(f"BT Multiplier:    {result.building_type_multiplier:.2f}x")
    print(f"Final Adjustment: {result.final_adjustment:.1%}")
    
    if hard_cost:
        cost_impact = hard_cost * result.final_adjustment
        print("-"*80)
        print(f"Hard Cost:        ${hard_cost:,.0f}")
        print(f"Cost Impact:      ${cost_impact:,.0f}")
        print(f"Total w/ Geo:     ${hard_cost + cost_impact:,.0f}")
    
    print("-"*80)
    print(f"Notes: {result.notes}")
    print("="*80 + "\n")

def compare_regions_table(assessment: GeotechnicalAssessment, regions: List[str]) -> None:
    """Print comparison table of regions"""
    results = assessment.compare_regions(regions)
    
    print("\n" + "="*80)
    print("REGIONAL GEOTECHNICAL COST COMPARISON")
    print("="*80)
    print(f"{'Region':<20} {'Adjustment':<15} {'Confidence':<15} {'Notes':<30}")
    print("-"*80)
    
    for result in results:
        print(f"{result['region']:<20} {result['final_adjustment']:>6.1%}          {result['confidence']:<15} {result['notes'][:30]}")
    
    print("="*80 + "\n")

# ============================================================================
# EXAMPLE USAGE
# ============================================================================

if __name__ == "__main__":
    
    # Initialize assessment engine
    assessment = GeotechnicalAssessment()
    
    # Example 1: Assess Advantech project
    print("\n### EXAMPLE 1: Advantech North America Campus ###")
    result = assessment.assess(
        region="CA_Inland",
        building_type="commercial_office",
        stage="BIDDING",
        hard_cost=75500000
    )
    print_assessment(result, hard_cost=75500000)
    
    # Example 2: Compare California regions
    print("\n### EXAMPLE 2: California Regional Comparison ###")
    ca_regions = ["CA_Coastal", "CA_Inland", "CA_Bay_Area"]
    compare_regions_table(assessment, ca_regions)
    
    # Example 3: Estimate cost impact for Houston warehouse
    print("\n### EXAMPLE 3: Houston Distribution Center ###")
    impact = assessment.estimate_cost_impact(
        region="TX_Coastal",
        building_type="warehouse",
        hard_cost=50000000,
        stage="BIDDING"
    )
    print(json.dumps(impact, indent=2))
    
    # Example 4: Get historical data
    print("\n### EXAMPLE 4: Historical Data for CA Inland ###")
    hist = assessment.get_historical_data("CA_Inland", "warehouse")
    print(json.dumps(hist, indent=2))
